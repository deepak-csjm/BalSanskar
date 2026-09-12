import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { USER_ROLES, type UserRole } from '@balsanskar/shared';
import { getConfig } from '../config.js';
import { unauthenticated } from './errors.js';

/**
 * Access tokens.
 *
 * Short-lived (15 minutes by default) and stateless, so that a request does not
 * cost a database round trip just to learn who is calling. Everything that can
 * change slowly — role, school, district — is baked in; anything that must take
 * effect immediately (suspension) is checked against the database on the
 * request path, see `authenticate`.
 */
export interface AccessClaims {
  sub: string;
  role: UserRole;
  districtId: string | null;
  blockId: string | null;
  schoolId: string | null;
  sid: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getConfig().JWT_SECRET);
}

export async function signAccessToken(
  claims: AccessClaims,
): Promise<{ token: string; expiresIn: number }> {
  const config = getConfig();
  const expiresIn = config.ACCESS_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({
    role: claims.role,
    districtId: claims.districtId,
    blockId: claims.blockId,
    schoolId: claims.schoolId,
    sid: claims.sid,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer(config.JWT_ISSUER)
    .setAudience(config.JWT_AUDIENCE)
    .setExpirationTime(`${expiresIn}s`)
    .sign(secretKey());
  return { token, expiresIn };
}

function readString(payload: JWTPayload, key: string): string | null {
  const value = payload[key];
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const config = getConfig();
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, secretKey(), {
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      algorithms: ['HS256'],
      clockTolerance: 5,
    }));
  } catch {
    throw unauthenticated('Your session has expired. Please sign in again.');
  }

  const sub = payload.sub;
  const role = readString(payload, 'role');
  const sid = readString(payload, 'sid');
  if (!sub || !role || !sid || !USER_ROLES.includes(role as UserRole)) {
    throw unauthenticated('Malformed session token');
  }

  return {
    sub,
    role: role as UserRole,
    districtId: readString(payload, 'districtId'),
    blockId: readString(payload, 'blockId'),
    schoolId: readString(payload, 'schoolId'),
    sid,
  };
}
