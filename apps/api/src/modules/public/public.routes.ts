import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  ACTIVITY_CATEGORIES,
  cleanText,
  idSchema,
  paginationSchema,
  publicDisplayName,
  type PublicActivity,
} from '@balsanskar/shared';
import { getPrisma } from '../../lib/prisma.js';
import { getConfig } from '../../config.js';
import { decodeCursor, paginate, parseOrThrow } from '../../lib/validate.js';
import { getStorage } from '../../lib/storage.js';
import { notFound } from '../../lib/errors.js';
import { toApiClassLevels } from '../../lib/class-level.js';

/**
 * The public showcase: what the department can point at.
 *
 * Everything here is reachable without signing in, so this file is written
 * defensively. It never selects a teacher's phone number, a guardian's name, a
 * child's surname, roll number or class section. Rather than filtering an
 * internal type down, it builds its own narrow response object, so a field added
 * to the internal model in six months' time cannot silently appear on the open
 * web.
 *
 * A record reaches this endpoint only if it is PUBLISHED, marked PUBLIC by a
 * district-level moderator, and — at the moment of publication — covered by
 * guardian consent for every named child.
 */

const publicListQuery = paginationSchema.extend({
  districtId: idSchema.optional(),
  blockId: idSchema.optional(),
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  search: cleanText(1, 60).optional(),
});

export const publicRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();
  const config = getConfig();

  // Unauthenticated and therefore cheap to hammer; limited well below the
  // signed-in allowance.
  const publicLimit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

  app.get('/public/activities', publicLimit, async (request, reply) => {
    if (!config.PUBLIC_SHOWCASE_ENABLED) throw notFound('The public showcase is not enabled');
    const query = parseOrThrow(publicListQuery, request.query);
    const cursorId = decodeCursor(query.cursor);

    const rows = await prisma.activity.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        ...(query.districtId ? { districtId: query.districtId } : {}),
        ...(query.blockId ? { blockId: query.blockId } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.search ? { title: { startsWith: query.search, mode: 'insensitive' } } : {}),
      },
      select: publicSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const page = paginate(rows, query.limit, (row) => row.id);
    return reply
      .header('cache-control', 'public, max-age=60')
      .send({
        items: await Promise.all(page.items.map(toPublicActivity)),
        nextCursor: page.nextCursor,
      });
  });

  app.get('/public/activities/:id', publicLimit, async (request, reply) => {
    if (!config.PUBLIC_SHOWCASE_ENABLED) throw notFound('The public showcase is not enabled');
    const { id } = parseOrThrow(z.object({ id: idSchema }), request.params);
    const row = await prisma.activity.findFirst({
      where: { id, status: 'PUBLISHED', visibility: 'PUBLIC' },
      select: publicSelect,
    });
    if (!row) throw notFound('Activity not found');
    return reply
      .header('cache-control', 'public, max-age=60')
      .send(await toPublicActivity(row));
  });

  /**
   * Headline numbers for the landing page.
   *
   * Aggregate only — no school is named, so this cannot be used to work out
   * which villages have children on the platform.
   */
  app.get('/public/statistics', publicLimit, async (_request, reply) => {
    if (!config.PUBLIC_SHOWCASE_ENABLED) throw notFound('The public showcase is not enabled');
    const [districts, schools, activities, achievements] = await Promise.all([
      prisma.district.count(),
      prisma.school.count({ where: { isActive: true, users: { some: { status: 'ACTIVE' } } } }),
      prisma.activity.count({ where: { status: 'PUBLISHED' } }),
      prisma.achievement.count({ where: { status: 'VERIFIED' } }),
    ]);
    return reply
      .header('cache-control', 'public, max-age=300')
      .send({ districts, participatingSchools: schools, publishedActivities: activities, verifiedAchievements: achievements });
  });
};

const publicSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  occurredOn: true,
  publishedAt: true,
  classLevels: true,
  participantCount: true,
  school: { select: { nameHi: true } },
  block: { select: { nameHi: true } },
  district: { select: { nameHi: true } },
  media: {
    orderBy: { order: 'asc' as const },
    // Only photographs a moderator has confirmed against a consent slip.
    where: { consentVerified: true },
    select: {
      caption: true,
      asset: { select: { storageKey: true, width: true, height: true, kind: true } },
    },
  },
  recognisedStudents: {
    // The surname is fetched and then discarded by publicDisplayName; nothing
    // below the given name reaches the response.
    select: { student: { select: { fullName: true, classLevel: true } } },
  },
};

type PublicRow = {
  id: string;
  title: string;
  description: string;
  category: PublicActivity['category'];
  occurredOn: Date;
  publishedAt: Date | null;
  classLevels: Parameters<typeof toApiClassLevels>[0];
  participantCount: number | null;
  school: { nameHi: string };
  block: { nameHi: string };
  district: { nameHi: string };
  media: Array<{
    caption: string | null;
    asset: { storageKey: string; width: number | null; height: number | null; kind: string };
  }>;
  recognisedStudents: Array<{
    student: { fullName: string; classLevel: Parameters<typeof toApiClassLevels>[0][number] };
  }>;
};

async function toPublicActivity(row: PublicRow): Promise<PublicActivity> {
  const storage = getStorage();
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    occurredOn: row.occurredOn.toISOString().slice(0, 10),
    schoolName: row.school.nameHi,
    blockName: row.block.nameHi,
    districtName: row.district.nameHi,
    classLevels: toApiClassLevels(row.classLevels),
    participantCount: row.participantCount,
    media: await Promise.all(
      row.media
        .filter((item) => item.asset.kind === 'IMAGE')
        .map(async (item) => ({
          // A signed, expiring URL even here: a photograph must stop being
          // reachable once the activity is unpublished or consent is withdrawn.
          url: await storage.getSignedReadUrl(item.asset.storageKey),
          caption: item.caption,
          width: item.asset.width,
          height: item.asset.height,
        })),
    ),
    recognisedStudents: row.recognisedStudents.map((link) => ({
      displayName: publicDisplayName(link.student.fullName),
      classLevel: toApiClassLevels([link.student.classLevel])[0]!,
    })),
    publishedAt: (row.publishedAt ?? row.occurredOn).toISOString(),
  };
}
