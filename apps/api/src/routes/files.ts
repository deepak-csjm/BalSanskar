import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '@balsanskar/shared';
import { getConfig } from '../config.js';
import { parseOrThrow } from '../lib/validate.js';
import { AppError, ERROR_CODES, badRequest, notFound } from '../lib/errors.js';
import { getStorage, verifySignedStorageToken } from '../lib/storage.js';

/**
 * File transfer for the `local` storage driver.
 *
 * When the platform runs against S3 or MinIO the browser talks to the object
 * store directly and these routes are never reached. They exist so that a
 * district pilot on a single VM needs nothing beyond Postgres and this process.
 *
 * Authorisation comes from the signed token in the query string rather than from
 * a session: the token names exactly one key, one operation and one expiry, so
 * a leaked download link grants access to one photograph for fifteen minutes and
 * nothing else.
 */
export const fileRoutes: FastifyPluginAsync = async (app) => {
  const config = getConfig();
  const storage = getStorage();

  const tokenQuery = z.object({ token: z.string().min(10).max(2000) });

  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES },
    (_request, body, done) => done(null, body),
  );

  app.put('/files/upload', async (request, reply) => {
    if (storage.kind !== 'local') {
      throw notFound('Direct upload is not enabled; use the signed URL from the upload ticket');
    }
    const { token } = parseOrThrow(tokenQuery, request.query);
    const payload = verifySignedStorageToken(token, config.JWT_SECRET, 'write');

    const body = request.body;
    if (!Buffer.isBuffer(body)) {
      throw badRequest('Send the file as raw bytes with the declared content type');
    }
    if (payload.maxBytes !== undefined && body.length > payload.maxBytes) {
      throw new AppError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, 'The file is larger than declared');
    }
    const declared = request.headers['content-type']?.split(';')[0]?.trim();
    if (payload.contentType && declared !== payload.contentType) {
      throw new AppError(
        415,
        ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
        'The content type does not match the upload ticket',
      );
    }
    if (!looksLikeDeclaredType(body, payload.contentType)) {
      // A ".jpg" that is actually an HTML document is the classic stored-XSS
      // vector; the magic bytes have to agree with the declared type.
      throw new AppError(
        415,
        ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
        'That file does not look like the image type it claims to be',
      );
    }

    await storage.put(payload.key, body, payload.contentType ?? 'application/octet-stream');
    return reply.status(204).send();
  });

  app.get('/files/download', async (request, reply) => {
    if (storage.kind !== 'local' || !storage.createReadStream) {
      throw notFound('Direct download is not enabled');
    }
    const { token } = parseOrThrow(tokenQuery, request.query);
    const payload = verifySignedStorageToken(token, config.JWT_SECRET, 'read');
    const file = await storage.createReadStream(payload.key);

    return (
      reply
        .header('content-type', file.contentType)
        .header('content-length', String(file.sizeBytes))
        // Never let a browser render an uploaded file as a document in this origin.
        .header('content-disposition', 'inline')
        .header('x-content-type-options', 'nosniff')
        .header('content-security-policy', "default-src 'none'; sandbox")
        .header('cache-control', 'private, max-age=300')
        .send(file.stream)
    );
  });
};

/** Magic-byte check for the handful of types the platform accepts. */
function looksLikeDeclaredType(body: Buffer, contentType: string | undefined): boolean {
  if (body.length < 12) return false;
  switch (contentType) {
    case 'image/jpeg':
      return body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
    case 'image/png':
      return body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47;
    case 'image/webp':
      return (
        body.subarray(0, 4).toString('ascii') === 'RIFF' &&
        body.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    case 'application/pdf':
      return body.subarray(0, 5).toString('ascii') === '%PDF-';
    default:
      return false;
  }
}
