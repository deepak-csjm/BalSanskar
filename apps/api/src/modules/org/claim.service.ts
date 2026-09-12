import type { Prisma, PrismaClient } from '@prisma/client';
import {
  CLAIM_TTL_DAYS,
  type ClaimReceipt,
  type CreateSchoolClaimInput,
  type DecideClaimInput,
  type ListClaimsQuery,
  type SchoolClaim,
} from '@balsanskar/shared';
import { badRequest, conflict, invalidState, notFound, tooManyRequests } from '../../lib/errors.js';
import { decodeCursor, paginate } from '../../lib/validate.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter } from '../../lib/scope.js';
import { isPrismaError, PG_ERROR } from '../../lib/prisma.js';
import { getStorage } from '../../lib/storage.js';
import type { Actor } from '../../plugins/auth.js';
import { consumeOtp } from '../auth/auth.service.js';

/**
 * Claiming a school.
 *
 * Uttar Pradesh has roughly 130,000 basic schools; nobody is typing those in,
 * and waiting for a complete departmental export before a single teacher can
 * use the platform means launching in a year rather than a month. The opposite
 * failure is worse: if anyone can create a school, the platform acquires fake
 * schools, and fake schools acquire photographs of children.
 *
 * So a school is never created by a user — it is claimed against its UDISE
 * code and confirmed by the block office, which is the level at which somebody
 * actually knows whether the claimant is the head teacher they say they are.
 */

const claimInclude = {
  block: { select: { id: true, nameHi: true } },
  district: { select: { nameHi: true } },
  reviewedBy: { select: { fullName: true } },
} satisfies Prisma.SchoolClaimInclude;

type ClaimRow = Prisma.SchoolClaimGetPayload<{ include: typeof claimInclude }>;

async function toClaim(prisma: PrismaClient, row: ClaimRow): Promise<SchoolClaim> {
  const registered = await prisma.school.findUnique({
    where: { udiseCode: row.udiseCode },
    select: { nameHi: true },
  });
  return {
    id: row.id,
    udiseCode: row.udiseCode,
    status: row.status,
    blockId: row.blockId,
    blockName: row.block.nameHi,
    districtName: row.district.nameHi,
    proposedNameHi: row.proposedNameHi,
    proposedNameEn: row.proposedNameEn,
    proposedType: row.proposedType,
    villageOrWard: row.villageOrWard,
    claimantName: row.claimantName,
    claimantPhone: row.claimantPhone,
    claimantDesignation: row.claimantDesignation,
    claimantEmployeeCode: row.claimantEmployeeCode,
    evidenceUrl: row.evidenceKey ? await getStorage().getSignedReadUrl(row.evidenceKey) : null,
    matchesRegister: registered !== null,
    registeredNameHi: registered?.nameHi ?? null,
    reviewedByName: row.reviewedBy?.fullName ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Raises a claim.
 *
 * The phone is verified by one-time code before this runs, so every claim
 * traces to a number. Nothing here creates a school or an account: the officer
 * decides, and until they do the claimant has exactly the access they had
 * before, which is none.
 */
export async function createSchoolClaim(
  prisma: PrismaClient,
  input: CreateSchoolClaimInput,
  audit: AuditContext,
): Promise<ClaimReceipt> {
  await consumeOtp(prisma, { phone: input.phone, code: input.code, purpose: 'REGISTRATION' });

  const block = await prisma.block.findUnique({
    where: { id: input.blockId },
    select: { id: true, nameHi: true, districtId: true },
  });
  if (!block) throw notFound('Block not found');

  // Already a live school with an account on it: this is a teacher who should
  // be registering, not claiming, and telling them so saves a wasted week.
  const existing = await prisma.school.findUnique({
    where: { udiseCode: input.udiseCode },
    select: { id: true, status: true, _count: { select: { users: true } } },
  });
  if (existing && existing.status === 'ACTIVE' && existing._count.users > 0) {
    throw conflict(
      'This school is already on the platform. Please register as a teacher instead, and your head teacher will approve you.',
    );
  }

  /**
   * Retire an abandoned claim on this code before looking at what blocks it.
   *
   * The failure this prevents is permanent and silent. One claim nobody follows
   * up — a wrong number, a typo, someone who thought better of it — and the
   * school is locked out of the platform for good: no journey in the product
   * can clear it, and the next head teacher is shown nothing but the given name
   * of a stranger. A partial unique index enforces one live claim per code, so
   * without this the row keeps its slot for ever.
   *
   * Done here, on the way past, rather than left to `expireStaleClaims`. That
   * sweep keeps the officer's queue honest, but a school must not stay locked
   * out because somebody forgot to schedule a cron entry.
   */
  await prisma.schoolClaim.updateMany({
    where: { udiseCode: input.udiseCode, status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });

  const pending = await prisma.schoolClaim.findFirst({
    where: {
      udiseCode: input.udiseCode,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    select: { claimantName: true, claimantDesignation: true, expiresAt: true },
  });
  if (pending) {
    // Enough for two colleagues to sort out an honest collision between
    // themselves; never enough to be a directory of who works where.
    const givenName = pending.claimantName.trim().split(/\s+/)[0] ?? '';
    return {
      status: 'ALREADY_CLAIMED',
      claimId: null,
      blockName: block.nameHi,
      existingClaimantHint: pending.claimantDesignation
        ? `${givenName} (${pending.claimantDesignation})`
        : givenName,
      expiresAt: pending.expiresAt.toISOString(),
    };
  }

  // A ceiling per number, so one person cannot paper the block with claims.
  const dayAgo = new Date(Date.now() - 86_400_000);
  const recent = await prisma.schoolClaim.count({
    where: { claimantPhone: input.phone, createdAt: { gte: dayAgo } },
  });
  if (recent >= 3) {
    throw tooManyRequests(
      'Too many school claims from this number today. Please contact your block office.',
    );
  }

  const expiresAt = new Date(Date.now() + CLAIM_TTL_DAYS * 86_400_000);

  try {
    const claim = await prisma.$transaction(async (tx) => {
      const created = await tx.schoolClaim.create({
        data: {
          udiseCode: input.udiseCode,
          blockId: block.id,
          districtId: block.districtId,
          proposedNameHi: input.proposedNameHi,
          proposedNameEn: input.proposedNameEn ?? null,
          proposedType: input.proposedType,
          villageOrWard: input.villageOrWard ?? null,
          claimantName: input.claimantName,
          claimantPhone: input.phone,
          claimantDesignation: input.claimantDesignation ?? null,
          claimantEmployeeCode: input.claimantEmployeeCode ?? null,
          evidenceKey: input.evidenceKey ?? null,
          expiresAt,
        },
      });
      await recordAudit(tx, audit, {
        action: 'SCHOOL_CLAIM_RAISED',
        entityType: 'SchoolClaim',
        entityId: created.id,
        blockId: block.id,
        districtId: block.districtId,
        metadata: { udiseCode: input.udiseCode, matchesRegister: existing !== null },
      });
      if (input.evidenceKey) {
        await tx.mediaAsset.updateMany({
          where: { storageKey: input.evidenceKey },
          data: { attachedAt: new Date() },
        });
      }
      return created;
    });

    return {
      status: 'PENDING',
      claimId: claim.id,
      blockName: block.nameHi,
      existingClaimantHint: null,
      expiresAt: claim.expiresAt.toISOString(),
    };
  } catch (error) {
    // The partial unique index caught a race between two simultaneous claims.
    if (isPrismaError(error, PG_ERROR.UNIQUE_VIOLATION)) {
      throw conflict(
        'Someone else is already claiming this school. Please check with your colleagues.',
      );
    }
    throw error;
  }
}

export async function listSchoolClaims(
  prisma: PrismaClient,
  actor: Actor,
  query: ListClaimsQuery,
): Promise<{ items: SchoolClaim[]; nextCursor: string | null }> {
  const scope = resolveScopeFilter(actor, {
    blockId: query.blockId,
    districtId: query.districtId,
  });
  const cursorId = decodeCursor(query.cursor);

  const rows = await prisma.schoolClaim.findMany({
    where: {
      ...(scope.blockId
        ? { blockId: scope.blockId }
        : scope.districtId
          ? { districtId: scope.districtId }
          : {}),
      status: query.status ?? 'PENDING',
    },
    include: claimInclude,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: query.limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const page = paginate(rows, query.limit, (row) => row.id);
  return {
    items: await Promise.all(page.items.map((row) => toClaim(prisma, row))),
    nextCursor: page.nextCursor,
  };
}

/**
 * The block officer's decision.
 *
 * Verifying does three things at once, in one transaction: the school becomes
 * real (created from the claim, or activated if the register already held it),
 * the claimant becomes its head teacher, and the whole thing is audited. A
 * half-applied version of that would leave a school nobody can administer.
 */
export async function decideSchoolClaim(
  prisma: PrismaClient,
  actor: Actor,
  claimId: string,
  input: DecideClaimInput,
  audit: AuditContext,
): Promise<SchoolClaim> {
  const claim = await prisma.schoolClaim.findUnique({
    where: { id: claimId },
    include: claimInclude,
  });
  if (!claim) throw notFound('Claim not found');

  resolveScopeFilter(actor, { blockId: claim.blockId, districtId: claim.districtId });

  if (claim.status !== 'PENDING') {
    throw invalidState(`This claim has already been ${claim.status.toLowerCase()}`);
  }
  if (claim.expiresAt.getTime() < Date.now()) {
    throw invalidState('This claim has expired. Ask the head teacher to raise it again.');
  }

  if (input.decision === 'REJECT') {
    if (!input.note) {
      throw badRequest('Give a reason so the head teacher knows what to correct', {
        note: ['A reason is required when rejecting a claim'],
      });
    }
    const rejected = await prisma.$transaction(async (tx) => {
      const row = await tx.schoolClaim.update({
        where: { id: claimId },
        data: {
          status: 'REJECTED',
          reviewedById: actor.id,
          reviewedAt: new Date(),
          reviewNote: input.note ?? null,
        },
        include: claimInclude,
      });
      await recordAudit(tx, audit, {
        action: 'SCHOOL_CLAIM_REJECTED',
        entityType: 'SchoolClaim',
        entityId: claimId,
        blockId: claim.blockId,
        districtId: claim.districtId,
        metadata: { udiseCode: claim.udiseCode, reason: input.note },
      });
      return row;
    });
    return toClaim(prisma, rejected);
  }

  const verified = await prisma.$transaction(async (tx) => {
    // The register may already hold this school (loaded from a UDISE export) or
    // may not (this block has had no import yet). Either way the officer's
    // decision is what makes it usable.
    const existing = await tx.school.findUnique({ where: { udiseCode: claim.udiseCode } });

    const school = existing
      ? await tx.school.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            isActive: true,
            ...(input.correctedNameHi ? { nameHi: input.correctedNameHi } : {}),
            ...(input.correctedNameEn ? { nameEn: input.correctedNameEn } : {}),
          },
        })
      : await tx.school.create({
          data: {
            udiseCode: claim.udiseCode,
            nameHi: input.correctedNameHi ?? claim.proposedNameHi,
            nameEn: input.correctedNameEn ?? claim.proposedNameEn,
            type: claim.proposedType,
            blockId: claim.blockId,
            districtId: claim.districtId,
            villageOrWard: claim.villageOrWard,
            status: 'ACTIVE',
            trustTier: 'NEW',
          },
        });

    // The claimant becomes the school's head teacher. Their number was verified
    // when the claim was raised and an officer has now vouched for them, which
    // together is a stronger check than the self-registration path gets.
    const existingUser = await tx.user.findUnique({ where: { phone: claim.claimantPhone } });
    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          role: 'PRINCIPAL',
          status: 'ACTIVE',
          schoolId: school.id,
          blockId: school.blockId,
          districtId: school.districtId,
          approvedById: actor.id,
          approvedAt: new Date(),
        },
      });
    } else {
      await tx.user.create({
        data: {
          phone: claim.claimantPhone,
          fullName: claim.claimantName,
          role: 'PRINCIPAL',
          status: 'ACTIVE',
          designation: claim.claimantDesignation,
          employeeCode: claim.claimantEmployeeCode,
          schoolId: school.id,
          blockId: school.blockId,
          districtId: school.districtId,
          approvedById: actor.id,
          approvedAt: new Date(),
        },
      });
    }

    const row = await tx.schoolClaim.update({
      where: { id: claimId },
      data: {
        status: 'VERIFIED',
        schoolId: school.id,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewNote: input.note ?? null,
      },
      include: claimInclude,
    });

    await recordAudit(tx, audit, {
      action: 'SCHOOL_CLAIM_VERIFIED',
      entityType: 'SchoolClaim',
      entityId: claimId,
      schoolId: school.id,
      blockId: school.blockId,
      districtId: school.districtId,
      metadata: {
        udiseCode: claim.udiseCode,
        createdSchool: existing === null,
        headTeacherPhone: claim.claimantPhone,
      },
    });

    return row;
  });

  return toClaim(prisma, verified);
}

/**
 * Frees the UDISE codes behind claims nobody acted on.
 *
 * Run from a scheduled job. Without it, one abandoned claim locks a school out
 * of the platform for good, which is a far worse outcome than an occasional
 * duplicate claim.
 */
export async function expireStaleClaims(prisma: PrismaClient): Promise<{ expired: number }> {
  const result = await prisma.schoolClaim.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return { expired: result.count };
}
