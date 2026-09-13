import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  dormantSchoolsQuerySchema,
  leaderboardQuerySchema,
  reportQuerySchema,
  idSchema,
  paginationSchema,
} from '@balsanskar/shared';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow, decodeCursor, paginate } from '../../lib/validate.js';
import { recordAudit } from '../../lib/audit.js';
import { resolveScopeFilter } from '../../lib/scope.js';
import { buildLeaderboard, buildOverview, findDormantSchools, toCsv } from './report.service.js';

export const reportRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();

  app.get('/reports/overview', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('report:read');
    const query = parseOrThrow(reportQuerySchema, request.query);
    return reply.send(await buildOverview(prisma, actor, query));
  });

  app.get('/reports/leaderboard', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('report:read');
    const query = parseOrThrow(leaderboardQuerySchema, request.query);
    return reply.send(await buildLeaderboard(prisma, actor, query));
  });

  app.get('/reports/dormant-schools', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('report:read');
    const query = parseOrThrow(dormantSchoolsQuerySchema, request.query);
    return reply.send({ items: await findDormantSchools(prisma, actor, query) });
  });

  /**
   * The export a district office actually sends upward.
   *
   * Exports are audited: a spreadsheet of school-level performance leaving the
   * platform is an event worth being able to account for later.
   */
  app.get('/reports/leaderboard.csv', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('report:export');
    const query = parseOrThrow(leaderboardQuerySchema, request.query);
    const board = await buildLeaderboard(prisma, actor, query);

    await recordAudit(prisma, request.auditContext(), {
      action: 'REPORT_EXPORTED',
      entityType: 'Report',
      entityId: `leaderboard:${board.groupBy}`,
      districtId: actor.districtId,
      blockId: actor.blockId,
      schoolId: actor.schoolId,
      metadata: { rows: board.rows.length, groupBy: board.groupBy },
    });

    const csv = toCsv(
      [
        board.groupBy === 'SCHOOL' ? 'School' : board.groupBy === 'BLOCK' ? 'Block' : 'District',
        'Parent',
        'Schools',
        'Active schools',
        'Published activities',
        'Verified achievements',
        'Child participations',
        'Last activity',
      ],
      board.rows.map((row) => [
        row.name,
        row.parentName,
        row.schools,
        row.activeSchools,
        row.publishedActivities,
        row.verifiedAchievements,
        row.childParticipations,
        row.lastActivityAt?.slice(0, 10) ?? '',
      ]),
    );

    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header(
        'content-disposition',
        `attachment; filename="balsanskar-${board.groupBy.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv"`,
      )
      .send(csv);
  });

  /**
   * The audit trail, readable by block level and above and always narrowed to
   * the reader's own area.
   */
  app.get('/audit', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('audit:read');
    const query = parseOrThrow(
      paginationSchema.extend({
        entityType: z.string().trim().max(40).optional(),
        entityId: idSchema.optional(),
        actorId: idSchema.optional(),
      }),
      request.query,
    );
    const scope = resolveScopeFilter(actor, {});
    const cursorId = decodeCursor(query.cursor);

    const rows = await prisma.auditEvent.findMany({
      where: {
        ...(scope.schoolId
          ? { schoolId: scope.schoolId }
          : scope.blockId
            ? { blockId: scope.blockId }
            : scope.districtId
              ? { districtId: scope.districtId }
              : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      include: { actor: { select: { fullName: true } } },
    });

    const page = paginate(rows, query.limit, (row) => row.id);
    return reply.send({
      items: page.items.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actorName: row.actor?.fullName ?? null,
        actorRole: row.actorRole,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    });
  });
};
