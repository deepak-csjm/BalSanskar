import {
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * Chosen over argon2 or bcrypt deliberately: both are native addons, and this
 * system has to be installable on whatever hardware a state data centre
 * provides, sometimes without a compiler. scrypt is memory-hard, is in the
 * platform already, and removes an entire class of deployment failure.
 *
 * Parameters are stored inside the hash so that they can be raised later
 * without invalidating existing passwords.
 */
/**
 * Work factor. 2^15 is roughly 100ms and 32MB per hash on modest hardware,
 * which is the right trade for a login that happens a few times a day.
 *
 * Lowered only under NODE_ENV=test, where the suite creates dozens of accounts
 * per file and the cost would dominate the run without testing anything. The
 * parameters live inside each stored hash, so raising this later re-hashes
 * nothing and breaks nothing.
 */
const SCRYPT_N = process.env.NODE_ENV === 'test' ? 1 << 12 : 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAXMEM,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (saltRaw === undefined || hashRaw === undefined) return false;

  const salt = Buffer.from(saltRaw, 'base64url');
  const expected = Buffer.from(hashRaw, 'base64url');
  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
      maxmem: Math.max(MAXMEM, 128 * N * r * 2),
    });
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * A six-digit one-time code.
 *
 * `randomInt` is used rather than `Math.random`: an SMS code is a credential,
 * and a predictable one lets an attacker take over any teacher's account by
 * knowing only their phone number.
 */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Hash for a one-time code or a refresh token.
 *
 * Fast on purpose: these values carry ~20 bytes of entropy (or, for OTPs, are
 * rate-limited to a handful of guesses), so the slow-hash argument does not
 * apply and per-request scrypt would be a denial-of-service surface. The
 * server-side pepper stops a leaked database from being replayed on its own.
 */
export function hashToken(value: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${value}`).digest('base64url');
}

export function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Still compare, so that the timing does not reveal the length.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}
