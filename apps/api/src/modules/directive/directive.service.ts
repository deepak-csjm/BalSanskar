import type { Prisma, PrismaClient } from '@prisma/client';
import {
  type AuthenticityResult,
  type Directive,
  type DirectiveUptake,
  type ListDirectivesQuery,
  type PublishDirectiveInput,
  type RespondToDirectiveInput,
  type ResponseState,
  type BlockedReason,
} from '@balsanskar/shared';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import type { Actor } from '../../plugins/auth.js';

/**
 * The register of orders, and the answer a school gives back.
 *
 * See packages/shared/src/contracts/directive.ts for why this exists. The two
 * rules that constrain every function here: the platform verifies and never
 * originates, and a school's answer is an acknowledgement rather than a
 * compliance score.
 */

/**
 * Letter numbers as typed by a person reading a photocopy.
 *
 * A पत्रांक is transcribed from a scanned letter, often on a phone, often from
 * a photograph of a photograph. Matching it literally would make the lookup
 * useless for exactly the person it is for, so case, spacing and the several
 * dashes that survive an OCR round trip are all folded away. Devanagari is
 * left alone: many order numbers carry a Hindi prefix and it is part of the
 * identifier.
 */
export function normaliseLetterNumber(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‐-―]/g, '-')
    .replace(/[\s_/\\.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

type DirectiveRow = Prisma.DirectiveGetPayload<{
  include: { responses: { include: { respondedBy: { select: { fullName: true } } } } };
}> & { supersededBy?: { id: string } | null };

function toDirective(row: DirectiveRow, schoolId: string | null): Directive {
  const mine = schoolId ? row.responses.find((r) => r.schoolId === schoolId) : undefined;
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    letterNumber: row.letterNumber,
    issuedOn: row.issuedOn.toISOString().slice(0, 10),
    issuingOffice: row.issuingOffice,
    title: row.title,
    plainSummary: row.plainSummary,
    documentUrl: row.documentUrl,
    dueBy: row.dueBy?.toISOString().slice(0, 10) ?? null,
    schoolTypes: row.schoolTypes,
    supersededById: row.supersededBy?.id ?? null,
    supersedesId: row.supersedesId,
    publishedByOffice: row.publishedByOffice,
    publishedAt: row.createdAt.toISOString(),
    myResponse: mine
      ? {
          state: mine.state,
          blockedReason: mine.blockedReason,
          note: mine.note,
          respondedByName: mine.respondedBy.fullName,
          respondedAt: mine.updatedAt.toISOString(),
        }
      : null,
  };
}

/**
 * Who may put what on the register.
 *
 * A block officer may publish a block instruction, and only that. This is the
 * Bareilly fodder case made structural: the problem there was not that a block
 * officer issued an instruction — they are entitled to — but that it reached
 * schools wearing the authority of a government order. Here a block officer
 * cannot label their own instruction a state order, and a district officer
 * cannot label theirs a court direction, so the rank a school sees is one the
 * publisher could not inflate.
 */
function assertMayPublish(actor: Actor, source: PublishDirectiveInput['source']): void {
  if (source === 'BLOCK_INSTRUCTION') {
    if (actor.role === 'BLOCK_ADMIN' || actor.blockId === null) return;
    return;
  }
  if (source === 'DISTRICT_ORDER') {
    if (actor.role === 'BLOCK_ADMIN') {
      throw forbidden('A block office cannot issue a district order');
    }
    return;
  }
  // A state order or a court direction is state-wide by nature.
  if (actor.role !== 'STATE_ADMIN' && actor.role !== 'SUPER_ADMIN') {
    throw forbidden(
      'Only the state office can put a state order or a court direction on the register',
    );
  }
}

export async function publishDirective(
  prisma: PrismaClient,
  actor: Actor,
  input: PublishDirectiveInput,
  audit: AuditContext,
): Promise<Directive> {
  assertMayPublish(actor, input.source);

  // Reach follows the publisher: a block officer's instruction reaches their
  // block, a district officer's reaches their district. Nobody can publish
  // beyond their own patch, whatever they label it.
  const blockId = actor.role === 'BLOCK_ADMIN' ? actor.blockId : null;
  const districtId =
    actor.role === 'DISTRICT_ADMIN' || actor.role === 'BLOCK_ADMIN' ? actor.districtId : null;

  if (input.supersedesId) {
    const previous = await prisma.directive.findUnique({
      where: { id: input.supersedesId },
      select: { id: true, status: true, supersededBy: { select: { id: true } } },
    });
    if (!previous) throw notFound('No such earlier order');
    if (previous.supersededBy) {
      throw conflict('That order has already been superseded by another');
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const directive = await tx.directive.create({
      data: {
        source: input.source,
        letterNumber: input.letterNumber,
        letterNumberNormalised: normaliseLetterNumber(input.letterNumber),
        issuedOn: dateOnly(input.issuedOn),
        issuingOffice: input.issuingOffice,
        title: input.title,
        plainSummary: input.plainSummary,
        documentUrl: input.documentUrl ?? null,
        dueBy: input.dueBy ? dateOnly(input.dueBy) : null,
        schoolTypes: input.schoolTypes,
        blockId,
        districtId,
        supersedesId: input.supersedesId ?? null,
        publishedById: actor.id,
        publishedByOffice: input.issuingOffice,
      },
      include: {
        responses: { include: { respondedBy: { select: { fullName: true } } } },
        supersededBy: { select: { id: true } },
      },
    });

    if (input.supersedesId) {
      await tx.directive.update({
        where: { id: input.supersedesId },
        data: { status: 'SUPERSEDED' },
      });
    }

    await recordAudit(tx, audit, {
      action: 'DIRECTIVE_PUBLISHED',
      entityType: 'Directive',
      entityId: directive.id,
      blockId,
      districtId,
      metadata: { source: input.source, letterNumber: input.letterNumber },
    });
    return directive;
  });

  return toDirective(created, actor.schoolId);
}

export async function withdrawDirective(
  prisma: PrismaClient,
  actor: Actor,
  id: string,
  audit: AuditContext,
): Promise<Directive> {
  const existing = await prisma.directive.findUnique({
    where: { id },
    select: { id: true, source: true, blockId: true, districtId: true, status: true },
  });
  if (!existing) throw notFound('No such order');
  assertMayPublish(actor, existing.source);
  if (existing.blockId && actor.blockId && existing.blockId !== actor.blockId) {
    throw forbidden('That order is outside your area');
  }
  if (existing.districtId && actor.districtId && existing.districtId !== actor.districtId) {
    throw forbidden('That order is outside your area');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.directive.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
      include: {
        responses: { include: { respondedBy: { select: { fullName: true } } } },
        supersededBy: { select: { id: true } },
      },
    });
    await recordAudit(tx, audit, {
      action: 'DIRECTIVE_WITHDRAWN',
      entityType: 'Directive',
      entityId: id,
      blockId: existing.blockId,
      districtId: existing.districtId,
    });
    return row;
  });
  return toDirective(updated, actor.schoolId);
}

/**
 * What currently applies to the caller.
 *
 * For a school this is the list nothing in the state can produce today: the
 * orders in force for this school, with the superseded ones out of the way.
 */
export async function listDirectives(
  prisma: PrismaClient,
  actor: Actor,
  query: ListDirectivesQuery,
): Promise<Directive[]> {
  const school = actor.schoolId
    ? await prisma.school.findUnique({
        where: { id: actor.schoolId },
        select: { id: true, type: true, blockId: true, districtId: true },
      })
    : null;

  // Reach is inclusive downward: a school sees state-wide orders, its own
  // district's, and its own block's. An officer sees what they could publish.
  const reach: Prisma.DirectiveWhereInput[] = [{ districtId: null, blockId: null }];
  const districtId = school?.districtId ?? actor.districtId;
  const blockId = school?.blockId ?? actor.blockId;
  if (districtId) reach.push({ districtId, blockId: null });
  if (blockId) reach.push({ blockId });

  const rows = await prisma.directive.findMany({
    where: {
      OR: reach,
      ...(query.includeInactive ? {} : { status: 'ACTIVE' }),
      ...(query.source ? { source: query.source } : {}),
      ...(school ? { OR2: undefined } : {}),
      ...(school
        ? {
            AND: [
              { OR: [{ schoolTypes: { isEmpty: true } }, { schoolTypes: { has: school.type } }] },
            ],
          }
        : {}),
      ...(query.unanswered && school ? { responses: { none: { schoolId: school.id } } } : {}),
    },
    include: {
      responses: {
        where: school ? { schoolId: school.id } : undefined,
        include: { respondedBy: { select: { fullName: true } } },
      },
      supersededBy: { select: { id: true } },
    },
    orderBy: [{ issuedOn: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });

  return rows.map((row) => toDirective(row, school?.id ?? null));
}

/**
 * Is this letter real?
 *
 * The whole feature, in one query. A head teacher holding a photograph of a
 * letter in a WhatsApp group has, today, no way at all to find out — and fake
 * closure orders and fake leave sanctions bearing officers' signatures are
 * documented.
 *
 * A miss is reported as a miss and never as a forgery. The register holds only
 * what has been published to it, which is a subset of what exists, and telling
 * a head teacher that a genuine order was fake would do more harm in an
 * afternoon than this saves in a year. The wording of that is in the client.
 */
export async function checkAuthenticity(
  prisma: PrismaClient,
  letterNumber: string,
): Promise<AuthenticityResult> {
  const normalised = normaliseLetterNumber(letterNumber);
  if (normalised.length < 3) {
    throw badRequest('Enter the order number as printed on the letter', {
      letterNumber: ['Too short to look up'],
    });
  }
  const matches = await prisma.directive.findMany({
    where: { letterNumberNormalised: normalised },
    select: {
      id: true,
      source: true,
      status: true,
      title: true,
      issuingOffice: true,
      issuedOn: true,
      supersededBy: { select: { id: true } },
    },
    orderBy: { issuedOn: 'desc' },
    take: 10,
  });

  return {
    letterNumber,
    found: matches.length > 0,
    matches: matches.map((row) => ({
      id: row.id,
      source: row.source,
      status: row.status,
      title: row.title,
      issuingOffice: row.issuingOffice,
      issuedOn: row.issuedOn.toISOString().slice(0, 10),
      supersededById: row.supersededBy?.id ?? null,
    })),
  };
}

export async function respondToDirective(
  prisma: PrismaClient,
  actor: Actor,
  directiveId: string,
  input: RespondToDirectiveInput,
  audit: AuditContext,
): Promise<Directive> {
  const { schoolId, blockId, districtId } = actor;
  if (!schoolId || !blockId || !districtId) {
    throw forbidden('Only a school can answer an order');
  }
  const directive = await prisma.directive.findUnique({
    where: { id: directiveId },
    select: { id: true, status: true, blockId: true, districtId: true },
  });
  if (!directive) throw notFound('No such order');
  if (directive.status !== 'ACTIVE') {
    throw conflict('That order is no longer in force');
  }
  if (directive.blockId && directive.blockId !== blockId) {
    throw forbidden('That order is not addressed to your school');
  }
  if (directive.districtId && directive.districtId !== districtId) {
    throw forbidden('That order is not addressed to your school');
  }

  await prisma.$transaction(async (tx) => {
    await tx.directiveResponse.upsert({
      where: { directiveId_schoolId: { directiveId, schoolId } },
      create: {
        directiveId,
        schoolId,
        blockId,
        districtId,
        state: input.state,
        blockedReason: input.blockedReason ?? null,
        note: input.note || null,
        respondedById: actor.id,
      },
      update: {
        state: input.state,
        // Cleared rather than left behind when an answer stops being blocked,
        // so a resolved shortage does not linger in the department's picture.
        blockedReason: input.blockedReason ?? null,
        note: input.note || null,
        respondedById: actor.id,
      },
    });
    await recordAudit(tx, audit, {
      action: 'DIRECTIVE_ANSWERED',
      entityType: 'Directive',
      entityId: directiveId,
      schoolId,
      blockId,
      districtId,
      metadata: { state: input.state, blockedReason: input.blockedReason ?? null },
    });
  });

  const row = await prisma.directive.findUniqueOrThrow({
    where: { id: directiveId },
    include: {
      responses: { where: { schoolId }, include: { respondedBy: { select: { fullName: true } } } },
      supersededBy: { select: { id: true } },
    },
  });
  return toDirective(row, schoolId);
}

/**
 * What the answers tell the office that issued the order.
 *
 * There is no per-school completion figure here and there is no ranking. The
 * headline is what is missing, and the blocked reasons always travel with the
 * counts — a red/amber/green on which schools completed a drive renders
 * undelivered money as teacher failure, and in this state head teachers have
 * had salaries withheld in bulk over data-compliance failures no individual
 * caused.
 */
export async function directiveUptake(
  prisma: PrismaClient,
  actor: Actor,
  directiveId: string,
): Promise<DirectiveUptake> {
  const directive = await prisma.directive.findUnique({
    where: { id: directiveId },
    select: {
      id: true,
      title: true,
      blockId: true,
      districtId: true,
      schoolTypes: true,
    },
  });
  if (!directive) throw notFound('No such order');
  if (actor.blockId && directive.blockId && directive.blockId !== actor.blockId) {
    throw forbidden('That order is outside your area');
  }
  if (actor.districtId && directive.districtId && directive.districtId !== actor.districtId) {
    throw forbidden('That order is outside your area');
  }

  // Scope the denominator to the caller's own reach as well as the order's, so
  // a block officer reads "how many of my schools" rather than a state total
  // they cannot act on.
  const schoolWhere: Prisma.SchoolWhereInput = {
    isActive: true,
    status: 'ACTIVE',
    ...((directive.blockId ?? actor.blockId)
      ? { blockId: directive.blockId ?? actor.blockId! }
      : {}),
    ...((directive.districtId ?? actor.districtId)
      ? { districtId: directive.districtId ?? actor.districtId! }
      : {}),
    ...(directive.schoolTypes.length ? { type: { in: directive.schoolTypes } } : {}),
  };

  const [schoolsInScope, byState, blockedBy] = await Promise.all([
    prisma.school.count({ where: schoolWhere }),
    prisma.directiveResponse.groupBy({
      by: ['state'],
      where: { directiveId, school: schoolWhere },
      _count: { _all: true },
    }),
    prisma.directiveResponse.groupBy({
      by: ['blockedReason'],
      where: { directiveId, state: 'BLOCKED', school: schoolWhere },
      _count: { _all: true },
    }),
  ]);

  const states = byState.map((row) => ({
    state: row.state as ResponseState,
    schools: row._count._all,
  }));

  return {
    directiveId,
    title: directive.title,
    schoolsInScope,
    responded: states.reduce((n, row) => n + row.schools, 0),
    byState: states,
    blockedBy: blockedBy
      .filter((row) => row.blockedReason !== null)
      .map((row) => ({ reason: row.blockedReason as BlockedReason, schools: row._count._all }))
      .sort((a, b) => b.schools - a.schools),
  };
}
