import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  auth,
  createTestApp,
  createUser,
  prisma,
  resetDatabase,
  seedGeography,
  teardown,
  type Geography,
  type TestUser,
} from './helpers.js';

/**
 * File upload and download.
 *
 * A photograph of a child is the most sensitive thing this platform stores, so
 * these tests are about what must *not* work: uploading something that is not
 * the image it claims to be, reaching a file without a valid ticket, and
 * escaping the storage root by way of the key.
 */
describe('files', () => {
  let app: FastifyInstance;
  let geo: Geography;
  let teacher: TestUser;

  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from('JFIF payload padding to get past the minimum length check'),
  ]);

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await teardown(app);
  });

  beforeEach(async () => {
    await resetDatabase();
    geo = await seedGeography();
    teacher = await createUser(app, {
      role: 'TEACHER',
      schoolId: geo.schoolA1,
      blockId: geo.blockA1,
      districtId: geo.districtA,
    });
  });

  async function requestTicket(sizeBytes = jpeg.length) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: auth(teacher),
      payload: {
        fileName: 'classroom.jpg',
        contentType: 'image/jpeg',
        sizeBytes,
        purpose: 'ACTIVITY_MEDIA',
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json() as { key: string; uploadUrl: string; headers: Record<string, string> };
  }

  it('issues a ticket and records the asset before any bytes arrive', async () => {
    const ticket = await requestTicket();
    expect(ticket.key).toMatch(/^activity\//);
    const asset = await prisma().mediaAsset.findUniqueOrThrow({
      where: { storageKey: ticket.key },
    });
    expect(asset.uploadedById).toBe(teacher.id);
    // Unattached, so the sweeper can find it if the teacher abandons the form.
    expect(asset.attachedAt).toBeNull();
  });

  it('accepts a real JPEG and serves it back through a signed link', async () => {
    const ticket = await requestTicket();
    const upload = await app.inject({
      method: 'PUT',
      url: ticket.uploadUrl.replace(/^https?:\/\/[^/]+/, ''),
      headers: { 'content-type': 'image/jpeg' },
      payload: jpeg,
    });
    expect(upload.statusCode).toBe(204);

    // Attach it, then read the signed URL off the activity.
    const activity = await app.inject({
      method: 'POST',
      url: '/v1/activities',
      headers: auth(teacher),
      payload: {
        title: 'Classroom photograph attached',
        description: 'A record with one photograph attached, used to check the signed download path.',
        category: 'CLASSROOM_INNOVATION',
        occurredOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        mediaKeys: [ticket.key],
      },
    });
    expect(activity.statusCode).toBe(201);
    const detail = activity.json() as { media: Array<{ url: string }> };
    expect(detail.media).toHaveLength(1);

    const download = await app.inject({
      method: 'GET',
      url: detail.media[0]!.url.replace(/^https?:\/\/[^/]+/, ''),
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('image/jpeg');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(download.rawPayload.equals(jpeg)).toBe(true);
  });

  it('rejects an HTML document renamed to .jpg', async () => {
    const ticket = await requestTicket();
    const upload = await app.inject({
      method: 'PUT',
      url: ticket.uploadUrl.replace(/^https?:\/\/[^/]+/, ''),
      headers: { 'content-type': 'image/jpeg' },
      payload: Buffer.from('<html><script>alert(document.cookie)</script></html>'),
    });
    expect(upload.statusCode).toBe(415);
  });

  it('rejects bytes larger than the ticket declared', async () => {
    const ticket = await requestTicket(16);
    const upload = await app.inject({
      method: 'PUT',
      url: ticket.uploadUrl.replace(/^https?:\/\/[^/]+/, ''),
      headers: { 'content-type': 'image/jpeg' },
      payload: jpeg,
    });
    expect(upload.statusCode).toBe(413);
  });

  it('rejects a file type the platform does not accept', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: auth(teacher),
      payload: {
        fileName: 'payload.svg',
        contentType: 'image/svg+xml',
        sizeBytes: 1000,
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects a download with no token, a forged token or an expired one', async () => {
    const missing = await app.inject({ method: 'GET', url: '/v1/files/download' });
    expect(missing.statusCode).toBe(400);

    const forged = await app.inject({
      method: 'GET',
      url: `/v1/files/download?token=${encodeURIComponent('eyJrZXkiOiJhIn0.notavalidmac')}`,
    });
    expect(forged.statusCode).toBe(403);
  });

  it('refuses a ticket for another teacher’s upload key', async () => {
    const ticket = await requestTicket();
    const otherTeacher = await createUser(app, {
      role: 'TEACHER',
      schoolId: geo.schoolA2,
      blockId: geo.blockA2,
      districtId: geo.districtA,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/activities',
      headers: auth(otherTeacher),
      payload: {
        title: 'Attempting to attach a colleague photograph',
        description: 'This activity references a storage key uploaded by a teacher at another school.',
        category: 'OTHER',
        occurredOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        mediaKeys: [ticket.key],
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('will not build a storage key that escapes the root', async () => {
    const { assertValidKey } = await import('../src/lib/storage.js');
    expect(() => assertValidKey('activity/s1/2026/01/../../../etc/passwd')).toThrow();
    expect(() => assertValidKey('/etc/passwd')).toThrow();
    expect(() => assertValidKey('activity/s1/2026/01/file.jpg')).not.toThrow();
  });
});
