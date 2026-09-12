import type { Prisma, PrismaClient, User } from '@prisma/client';
import {
  ERROR_CODES,
  permissionsFor,
  requiredScopeFields,
  type AuthSession,
  type OtpPurpose,
  type SessionUser,
  type UserRole,
} from '@balsanskar/shared';
import { getConfig } from '../../config.js';
import { AppError, conflict, forbidden, notFound, tooManyRequests, unauthenticated } from '../../lib/errors.js';
import {
  generateOtpCode,
  hashPassword,
  hashToken,
  randomToken,
  verifyPassword,
} from '../../lib/crypto.js';
import { signAccessToken } from '../../lib/tokens.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { getSmsProvider } from '../../lib/sms.js';

/**
 * Authentication.
 *
 * Two ways in, chosen to match how the users actually work:
 *
 *   - Teachers sign in with a one-time code sent to their phone. Most have a
 *     shared or basic handset, change devices often, and will not remember a
 *     twelve-character password. Their phone number is already the department's
 *     record of them.
 *   - Administrators sign in with a password from an office machine. They act on
 *     other people's accounts, so their credential must not be recoverable by
 *     anyone holding a SIM.
 */

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

const OTP_PEPPER_LABEL = 'otp';
const REFRESH_PEPPER_LABEL = 'refresh';

/**
 * Issues a one-time code.
 *
 * The response is identical whether or not the number is registered. Anything
 * else turns this endpoint into a directory of every teacher in the state.
 */
export async function requestOtp(
  prisma: PrismaClient,
  input: { phone: string; purpose: OtpPurpose },
  context: RequestContext,
): Promise<{ expiresInSeconds: number; resendAfterSeconds: number; devCode?: string }> {
  const config = getConfig();
  const now = new Date();

  const recent = await prisma.otpChallenge.findFirst({
    where: { phone: input.phone, purpose: input.purpose },
    orderBy: { createdAt: 'desc' },
  });

  if (recent) {
    const elapsedSeconds = (now.getTime() - recent.createdAt.getTime()) / 1000;
    if (elapsedSeconds < config.OTP_RESEND_COOLDOWN_SECONDS) {
      throw tooManyRequests(
        `Please wait ${Math.ceil(config.OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds)} seconds before asking for another code`,
      );
    }
  }

  // A hard hourly ceiling per number, on top of the per-request cooldown: the
  // cooldown stops accidental double-taps, this stops someone using the gateway
  // to bill the department for SMS.
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const sentThisHour = await prisma.otpChallenge.count({
    where: { phone: input.phone, createdAt: { gte: hourAgo } },
  });
  if (sentThisHour >= 8) {
    throw tooManyRequests('Too many codes requested for this number. Please try again in an hour.');
  }

  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + config.OTP_TTL_SECONDS * 1000);

  await prisma.otpChallenge.create({
    data: {
      phone: input.phone,
      codeHash: hashToken(code, `${config.JWT_SECRET}:${OTP_PEPPER_LABEL}`),
      purpose: input.purpose,
      expiresAt,
      requestIp: context.ip,
    },
  });

  await getSmsProvider().sendOtp(input.phone, code, config.OTP_TTL_SECONDS);

  return {
    expiresInSeconds: config.OTP_TTL_SECONDS,
    resendAfterSeconds: config.OTP_RESEND_COOLDOWN_SECONDS,
    // Only outside production, so a developer or a demo does not need a live gateway.
    ...(config.isProduction ? {} : { devCode: code }),
  };
}

/**
 * Checks a one-time code and burns it.
 *
 * Consumption happens inside a transaction with a conditional update, so two
 * requests racing on the same code cannot both succeed.
 */
export async function consumeOtp(
  prisma: PrismaClient,
  input: { phone: string; code: string; purpose: OtpPurpose },
): Promise<void> {
  const config = getConfig();
  const codeHash = hashToken(input.code, `${config.JWT_SECRET}:${OTP_PEPPER_LABEL}`);

  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone: input.phone, purpose: input.purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!challenge) {
    throw new AppError(400, ERROR_CODES.OTP_INVALID, 'That code is not valid. Please request a new one.');
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new AppError(400, ERROR_CODES.OTP_EXPIRED, 'That code has expired. Please request a new one.');
  }
  if (challenge.attempts >= config.OTP_MAX_ATTEMPTS) {
    throw new AppError(
      429,
      ERROR_CODES.OTP_ATTEMPTS_EXCEEDED,
      'Too many incorrect attempts. Please request a new code.',
    );
  }

  if (challenge.codeHash !== codeHash) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = config.OTP_MAX_ATTEMPTS - challenge.attempts - 1;
    throw new AppError(
      400,
      ERROR_CODES.OTP_INVALID,
      remaining > 0
        ? `That code is not correct. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
        : 'That code is not correct. Please request a new one.',
    );
  }

  const burned = await prisma.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (burned.count === 0) {
    throw new AppError(400, ERROR_CODES.OTP_INVALID, 'That code has already been used.');
  }
}

export async function loginWithOtp(
  prisma: PrismaClient,
  input: { phone: string; code: string },
  context: RequestContext,
): Promise<AuthSession> {
  await consumeOtp(prisma, { ...input, purpose: 'LOGIN' });

  const user = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (!user) {
    throw notFound('No account is registered with this number. Please register first.');
  }
  assertLoginAllowed(user);
  return startSession(prisma, user, context);
}

export async function loginWithPassword(
  prisma: PrismaClient,
  input: { identifier: string; password: string },
  context: RequestContext,
): Promise<AuthSession> {
  const identifier = input.identifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ phone: identifier }, { email: identifier.toLowerCase() }],
    },
  });

  // The dummy verification keeps the response time for an unknown account close
  // to that of a known one, so the endpoint does not confirm who has an account.
  if (!user?.passwordHash) {
    await verifyPassword(input.password, 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA');
    throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Those details do not match an account');
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Those details do not match an account');
  }

  assertLoginAllowed(user);
  return startSession(prisma, user, context);
}

function assertLoginAllowed(user: User): void {
  if (user.status === 'PENDING_APPROVAL') {
    throw new AppError(
      403,
      ERROR_CODES.ACCOUNT_PENDING,
      'Your account is waiting for approval by your head teacher or block office',
    );
  }
  if (user.status === 'SUSPENDED') {
    throw new AppError(403, ERROR_CODES.ACCOUNT_SUSPENDED, 'This account has been suspended');
  }
  if (user.status === 'REJECTED') {
    throw new AppError(
      403,
      ERROR_CODES.ACCOUNT_SUSPENDED,
      user.statusReason
        ? `This registration was not approved: ${user.statusReason}`
        : 'This registration was not approved',
    );
  }
}

/**
 * Registers a teacher against their school's UDISE code.
 *
 * The account is created in PENDING_APPROVAL and cannot do anything until the
 * head teacher or block office approves it. Self-service registration without
 * that gate would let anyone with a phone claim to teach at any school in the
 * state and start uploading photographs of children.
 */
export async function registerTeacher(
  prisma: PrismaClient,
  input: {
    phone: string;
    code: string;
    fullName: string;
    udiseCode: string;
    designation?: string;
    employeeCode?: string;
    email?: string;
  },
  context: RequestContext & AuditContext,
): Promise<{ status: 'PENDING_APPROVAL'; schoolName: string }> {
  await consumeOtp(prisma, { phone: input.phone, code: input.code, purpose: 'REGISTRATION' });

  const school = await prisma.school.findUnique({
    where: { udiseCode: input.udiseCode },
    select: { id: true, nameHi: true, blockId: true, districtId: true, isActive: true },
  });
  if (!school) {
    throw notFound('No school found with that UDISE code. Please check with your block office.');
  }
  if (!school.isActive) {
    throw conflict('That school is marked inactive. Please contact your block office.');
  }

  const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (existing) {
    throw conflict('An account already exists for this number. Please sign in instead.');
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        phone: input.phone,
        fullName: input.fullName,
        email: input.email?.toLowerCase() ?? null,
        role: 'TEACHER',
        status: 'PENDING_APPROVAL',
        designation: input.designation ?? null,
        employeeCode: input.employeeCode ?? null,
        schoolId: school.id,
        blockId: school.blockId,
        districtId: school.districtId,
      },
    });
    await recordAudit(
      tx,
      { actorId: created.id, actorRole: 'TEACHER', ip: context.ip, userAgent: context.userAgent },
      {
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: created.id,
        schoolId: school.id,
        blockId: school.blockId,
        districtId: school.districtId,
        metadata: { udiseCode: input.udiseCode },
      },
    );
    return created;
  });

  void user;
  return { status: 'PENDING_APPROVAL', schoolName: school.nameHi };
}

/**
 * Mints an access/refresh pair and records the device.
 *
 * `familyId` groups every rotation of one device's refresh token, which is what
 * makes reuse detection possible below.
 */
export async function startSession(
  prisma: PrismaClient,
  user: User,
  context: RequestContext,
): Promise<AuthSession> {
  const config = getConfig();
  const familyId = randomToken(16);
  const refreshToken = randomToken(48);

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken, `${config.JWT_SECRET}:${REFRESH_PEPPER_LABEL}`),
        familyId,
        expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
        userAgent: context.userAgent?.slice(0, 300) ?? null,
        ip: context.ip,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);

  const { token, expiresIn } = await signAccessToken({
    sub: user.id,
    role: user.role,
    districtId: user.districtId,
    blockId: user.blockId,
    schoolId: user.schoolId,
    sid: familyId,
  });

  return {
    tokens: { accessToken: token, refreshToken, accessTokenExpiresInSeconds: expiresIn },
    user: await toSessionUser(prisma, user),
  };
}

/**
 * Rotates a refresh token.
 *
 * A token that has already been rotated away is treated as stolen: the entire
 * family is revoked, forcing that device to sign in again. The alternative —
 * ignoring the reuse — lets an attacker who copied a token keep a parallel
 * session alive indefinitely.
 */
export async function refreshSession(
  prisma: PrismaClient,
  presentedToken: string,
  context: RequestContext,
): Promise<AuthSession> {
  const config = getConfig();
  const tokenHash = hashToken(presentedToken, `${config.JWT_SECRET}:${REFRESH_PEPPER_LABEL}`);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) throw unauthenticated('Please sign in again');

  if (stored.revokedAt || stored.replacedById) {
    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthenticated('Your session was ended for security reasons. Please sign in again.');
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    throw unauthenticated('Your session has expired. Please sign in again.');
  }

  assertLoginAllowed(stored.user);

  const nextToken = randomToken(48);
  const nextHash = hashToken(nextToken, `${config.JWT_SECRET}:${REFRESH_PEPPER_LABEL}`);

  await prisma.$transaction(async (tx) => {
    const replacement = await tx.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: nextHash,
        familyId: stored.familyId,
        expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
        userAgent: context.userAgent?.slice(0, 300) ?? null,
        ip: context.ip,
      },
    });
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: replacement.id },
    });
  });

  const { token, expiresIn } = await signAccessToken({
    sub: stored.user.id,
    role: stored.user.role,
    districtId: stored.user.districtId,
    blockId: stored.user.blockId,
    schoolId: stored.user.schoolId,
    sid: stored.familyId,
  });

  return {
    tokens: { accessToken: token, refreshToken: nextToken, accessTokenExpiresInSeconds: expiresIn },
    user: await toSessionUser(prisma, stored.user),
  };
}

export async function endSession(prisma: PrismaClient, refreshToken: string): Promise<void> {
  const config = getConfig();
  const tokenHash = hashToken(refreshToken, `${config.JWT_SECRET}:${REFRESH_PEPPER_LABEL}`);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored) return; // Signing out an unknown token is not an error worth reporting.
  await prisma.refreshToken.updateMany({
    where: { familyId: stored.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Signs every device out, used when a password changes or an account is suspended. */
export async function revokeAllSessions(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function setPassword(
  prisma: PrismaClient,
  userId: string,
  input: { currentPassword?: string; newPassword: string },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Account not found');

  // An existing password may only be replaced by someone who knows it. An account
  // that was created by an administrator has none yet and sets one freely.
  if (user.passwordHash) {
    if (!input.currentPassword) {
      throw forbidden('Enter your current password to change it');
    }
    const ok = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Your current password is not correct');
    }
  }

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, mustSetPassword: false },
    });
    // Changing a password ends every other session; that is the point of changing it.
    await revokeAllSessions(tx, userId);
  });
}

export async function toSessionUser(prisma: PrismaClient, user: User): Promise<SessionUser> {
  const [district, block, school] = await Promise.all([
    user.districtId
      ? prisma.district.findUnique({ where: { id: user.districtId }, select: { nameHi: true } })
      : null,
    user.blockId
      ? prisma.block.findUnique({ where: { id: user.blockId }, select: { nameHi: true } })
      : null,
    user.schoolId
      ? prisma.school.findUnique({ where: { id: user.schoolId }, select: { nameHi: true } })
      : null,
  ]);

  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    designation: user.designation,
    districtId: user.districtId,
    districtName: district?.nameHi ?? null,
    blockId: user.blockId,
    blockName: block?.nameHi ?? null,
    schoolId: user.schoolId,
    schoolName: school?.nameHi ?? null,
    permissions: permissionsFor(user.role),
    mustSetPassword: user.mustSetPassword,
  };
}

/**
 * Guards against an account existing with a reach its role cannot express — a
 * block admin with no block, say, which `isWithinScope` would then evaluate
 * against `null` forever.
 */
export function assertScopeComplete(
  role: UserRole,
  scope: { districtId?: string | null; blockId?: string | null; schoolId?: string | null },
): void {
  const missing = requiredScopeFields(role).filter((field) => !scope[field]);
  if (missing.length > 0) {
    throw new AppError(400, ERROR_CODES.VALIDATION_FAILED, `A ${role} account needs ${missing.join(', ')}`, {
      fields: Object.fromEntries(missing.map((field) => [field, ['Required for this role']])),
    });
  }
}
