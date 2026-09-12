import type { Prisma, PrismaClient } from '@prisma/client';
import {
  assignableRoles,
  hasAtLeastRole,
  type ApproveUserInput,
  type InviteUserInput,
  type ListUsersQuery,
  type UserSummary,
} from '@balsanskar/shared';
import { conflict, forbidden, invalidState, notFound } from '../../lib/errors.js';
import { decodeCursor, paginate } from '../../lib/validate.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter, type ScopeFilter } from '../../lib/scope.js';
import { isPrismaError, PG_ERROR } from '../../lib/prisma.js';
import type { Actor } from '../../plugins/auth.js';
import { assertScopeComplete, revokeAllSessions } from '../auth/auth.service.js';

const userInclude = {
  school: { select: { id: true, nameHi: true } },
  block: { select: { id: true, nameHi: true } },
  district: { select: { id: true, nameHi: true } },
} satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function toSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    role: row.role,
    status: row.status,
    designation: row.designation,
    employeeCode: row.employeeCode,
    schoolId: row.schoolId,
    schoolName: row.school?.nameHi ?? null,
    blockId: row.blockId,
    blockName: row.block?.nameHi ?? null,
    districtId: row.districtId,
    districtName: row.district?.nameHi ?? null,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  };
}

function scopeToUserWhere(scope: ScopeFilter): Prisma.UserWhereInput {
  if (scope.schoolId) return { schoolId: scope.schoolId };
  if (scope.blockId) return { blockId: scope.blockId };
  if (scope.districtId) return { districtId: scope.districtId };
  return {};
}

export async function listUsers(
  prisma: PrismaClient,
  actor: Actor,
  query: ListUsersQuery,
): Promise<{ items: UserSummary[]; nextCursor: string | null }> {
  const scope = resolveScopeFilter(actor, {
    schoolId: query.schoolId,
    blockId: query.blockId,
    districtId: query.districtId,
  });

  const cursorId = decodeCursor(query.cursor);
  const where: Prisma.UserWhereInput = {
    ...scopeToUserWhere(scope),
    ...(query.status ? { status: query.status } : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.search
      ? {
          OR: [
            { fullName: { startsWith: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
            { employeeCode: query.search },
          ],
        }
      : {}),
  };

  const rows = await prisma.user.findMany({
    where,
    include: userInclude,
    orderBy: { id: 'asc' },
    take: query.limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const page = paginate(rows, query.limit, (row) => row.id);
  return { items: page.items.map(toSummary), nextCursor: page.nextCursor };
}

/**
 * Loads a user the caller is entitled to act on.
 *
 * Two separate rules apply, and both matter:
 *   - the target must sit inside the caller's area, and
 *   - the caller must outrank the target, so a head teacher cannot suspend the
 *     block education officer who happens to be attached to their school.
 */
async function loadManageableUser(
  prisma: PrismaClient,
  actor: Actor,
  userId: string,
): Promise<UserRow> {
  const row = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!row) throw notFound('User not found');

  resolveScopeFilter(actor, {
    schoolId: row.schoolId ?? undefined,
    blockId: row.blockId ?? undefined,
    districtId: row.districtId ?? undefined,
  });

  if (row.id !== actor.id && hasAtLeastRole(row.role, actor.role)) {
    throw forbidden('You cannot manage an account at your own level or above');
  }
  return row;
}

export async function approveUser(
  prisma: PrismaClient,
  actor: Actor,
  userId: string,
  input: ApproveUserInput,
  audit: AuditContext,
): Promise<UserSummary> {
  const target = await loadManageableUser(prisma, actor, userId);
  if (target.status !== 'PENDING_APPROVAL') {
    throw invalidState(`This account is already ${target.status.toLowerCase().replace('_', ' ')}`);
  }
  if (target.id === actor.id) {
    throw forbidden('You cannot approve your own account');
  }

  const role = input.role ?? target.role;
  if (input.role && !assignableRoles(actor.role).includes(input.role)) {
    throw forbidden('You cannot grant that role');
  }
  assertScopeComplete(role, target);

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        role,
        approvedById: actor.id,
        approvedAt: new Date(),
        statusReason: input.note ?? null,
      },
      include: userInclude,
    });
    await recordAudit(tx, audit, {
      action: 'USER_APPROVED',
      entityType: 'User',
      entityId: user.id,
      schoolId: user.schoolId,
      blockId: user.blockId,
      districtId: user.districtId,
      metadata: { role },
    });
    return user;
  });

  return toSummary(updated);
}

export async function rejectUser(
  prisma: PrismaClient,
  actor: Actor,
  userId: string,
  reason: string,
  audit: AuditContext,
): Promise<UserSummary> {
  const target = await loadManageableUser(prisma, actor, userId);
  if (target.status !== 'PENDING_APPROVAL') {
    throw invalidState('Only a pending registration can be rejected');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { status: 'REJECTED', statusReason: reason, approvedById: actor.id, approvedAt: new Date() },
      include: userInclude,
    });
    await recordAudit(tx, audit, {
      action: 'USER_REJECTED',
      entityType: 'User',
      entityId: user.id,
      schoolId: user.schoolId,
      blockId: user.blockId,
      districtId: user.districtId,
      metadata: { reason },
    });
    return user;
  });
  return toSummary(updated);
}

export async function setUserSuspension(
  prisma: PrismaClient,
  actor: Actor,
  userId: string,
  suspended: boolean,
  reason: string | null,
  audit: AuditContext,
): Promise<UserSummary> {
  const target = await loadManageableUser(prisma, actor, userId);
  if (target.id === actor.id) throw forbidden('You cannot suspend your own account');

  if (suspended && target.status === 'SUSPENDED') return toSummary(target);
  if (!suspended && target.status !== 'SUSPENDED') {
    throw invalidState('This account is not suspended');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { status: suspended ? 'SUSPENDED' : 'ACTIVE', statusReason: reason },
      include: userInclude,
    });
    if (suspended) {
      // Suspension must take effect now, not when the access token expires.
      await revokeAllSessions(tx, userId);
    }
    await recordAudit(tx, audit, {
      action: suspended ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      entityType: 'User',
      entityId: user.id,
      schoolId: user.schoolId,
      blockId: user.blockId,
      districtId: user.districtId,
      metadata: reason ? { reason } : undefined,
    });
    return user;
  });
  return toSummary(updated);
}

export async function changeUserRole(
  prisma: PrismaClient,
  actor: Actor,
  userId: string,
  role: UserSummary['role'],
  audit: AuditContext,
): Promise<UserSummary> {
  const target = await loadManageableUser(prisma, actor, userId);
  if (!assignableRoles(actor.role).includes(role)) {
    throw forbidden('You cannot grant that role');
  }
  if (target.id === actor.id) throw forbidden('You cannot change your own role');
  assertScopeComplete(role, target);

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { role }, include: userInclude });
    // The old access token still carries the old role for up to its lifetime,
    // so end the sessions and make the change take effect immediately.
    await revokeAllSessions(tx, userId);
    await recordAudit(tx, audit, {
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: user.id,
      schoolId: user.schoolId,
      blockId: user.blockId,
      districtId: user.districtId,
      metadata: { from: target.role, to: role },
    });
    return user;
  });
  return toSummary(updated);
}

/**
 * Creates an account directly.
 *
 * Used for head teachers and office staff, who should not have to register and
 * then wait for themselves to be approved. The new account is ACTIVE but has no
 * password: the holder signs in by one-time code and sets one.
 */
export async function inviteUser(
  prisma: PrismaClient,
  actor: Actor,
  input: InviteUserInput,
  audit: AuditContext,
): Promise<UserSummary> {
  if (!assignableRoles(actor.role).includes(input.role)) {
    throw forbidden('You cannot create an account with that role');
  }

  const scope = await resolveInviteScope(prisma, input);
  resolveScopeFilter(actor, {
    schoolId: scope.schoolId ?? undefined,
    blockId: scope.blockId ?? undefined,
    districtId: scope.districtId ?? undefined,
  });
  assertScopeComplete(input.role, scope);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: input.phone,
          fullName: input.fullName,
          email: input.email?.toLowerCase() ?? null,
          role: input.role,
          status: 'ACTIVE',
          designation: input.designation ?? null,
          employeeCode: input.employeeCode ?? null,
          schoolId: scope.schoolId,
          blockId: scope.blockId,
          districtId: scope.districtId,
          approvedById: actor.id,
          approvedAt: new Date(),
          // Administrative roles are expected to set a password; teachers keep
          // using one-time codes and are never nagged for one.
          mustSetPassword: input.role !== 'TEACHER',
        },
        include: userInclude,
      });
      await recordAudit(tx, audit, {
        action: 'USER_APPROVED',
        entityType: 'User',
        entityId: user.id,
        schoolId: user.schoolId,
        blockId: user.blockId,
        districtId: user.districtId,
        metadata: { invited: true, role: input.role },
      });
      return user;
    });
    return toSummary(created);
  } catch (error) {
    if (isPrismaError(error, PG_ERROR.UNIQUE_VIOLATION)) {
      throw conflict('An account already exists with that phone number or email');
    }
    throw error;
  }
}

/**
 * Fills in the geography implied by whichever identifier the caller supplied.
 *
 * Naming a school is enough; the block and district follow from it and cannot be
 * contradicted, which stops an account being created that claims to be in one
 * district's reporting line while sitting in another's.
 */
async function resolveInviteScope(
  prisma: PrismaClient,
  input: InviteUserInput,
): Promise<{ schoolId: string | null; blockId: string | null; districtId: string | null }> {
  if (input.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: input.schoolId },
      select: { id: true, blockId: true, districtId: true },
    });
    if (!school) throw notFound('School not found');
    return { schoolId: school.id, blockId: school.blockId, districtId: school.districtId };
  }
  if (input.blockId) {
    const block = await prisma.block.findUnique({
      where: { id: input.blockId },
      select: { id: true, districtId: true },
    });
    if (!block) throw notFound('Block not found');
    return { schoolId: null, blockId: block.id, districtId: block.districtId };
  }
  if (input.districtId) {
    const district = await prisma.district.findUnique({
      where: { id: input.districtId },
      select: { id: true },
    });
    if (!district) throw notFound('District not found');
    return { schoolId: null, blockId: null, districtId: district.id };
  }
  return { schoolId: null, blockId: null, districtId: null };
}
