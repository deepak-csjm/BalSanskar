import { getConfig } from './config.js';
import { disconnectPrisma, getPrisma } from './lib/prisma.js';
import { expireStaleClaims } from './modules/org/claim.service.js';
import { expireOldMedia, sweepOrphanedUploads } from './modules/activity/media.service.js';

/**
 * The housekeeping that has to happen on a clock.
 *
 * A separate entry point rather than a timer inside the API, for three reasons.
 * A timer runs once per replica, so two containers means two concurrent sweeps.
 * It runs only while the process happens to be up, which is exactly when nobody
 * is watching. And it cannot be run by hand when an operator needs it to have
 * run now. A command that exits with a status is something a cron table, a
 * systemd timer or a Kubernetes CronJob can own, and something a person can
 * invoke while looking at the output.
 *
 * Both jobs are idempotent and safe to run concurrently with live traffic:
 * each only touches rows that are already past their deadline.
 *
 *   pnpm --filter @balsanskar/api maintenance
 *
 * Suggested schedule: hourly. Neither job is urgent to the minute, but the
 * upload sweep is the one that matters — see below.
 */
async function main(): Promise<void> {
  getConfig();
  const prisma = getPrisma();
  const started = Date.now();

  /**
   * Photographs of children that were uploaded and then abandoned.
   *
   * Every form someone starts and does not finish leaves an image in the
   * bucket. Without this, a photograph of a child taken for an activity that
   * was never submitted sits there for the life of the deployment, attached to
   * nothing, referenced by nothing, and visible in no interface that would let
   * anyone notice it was there. That is the kind of quiet accumulation the
   * consent rules exist to prevent, so it runs first and its failure is loud.
   */
  const uploads = await sweepOrphanedUploads(prisma);

  /**
   * Photographs that have outlived the activity they belong to.
   *
   * The largest lever on running cost and the one that makes it predictable:
   * uploads grow the store, this shrinks it, and after one retention window
   * they cancel. Also plain data minimisation — the counts survive in the
   * activity record, only the images go.
   */
  const expired = await expireOldMedia(prisma);

  /**
   * Claims nobody answered.
   *
   * The claim endpoint retires a stale claim on the way past, so a school is
   * never locked out of the platform even if this never runs. What this adds is
   * that a claim nobody will ever act on leaves the officer's queue on its own,
   * rather than waiting for someone to try claiming that school again.
   */
  const claims = await expireStaleClaims(prisma);

  console.log(
    JSON.stringify({
      task: 'maintenance',
      orphanedUploadsDeleted: uploads.deleted,
      expiredMediaDeleted: expired.deleted,
      staleClaimsExpired: claims.expired,
      durationMs: Date.now() - started,
    }),
  );
}

main()
  .then(async () => {
    await disconnectPrisma();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('Maintenance run failed');
    console.error(error);
    await disconnectPrisma().catch(() => {
      /* already gone */
    });
    process.exit(1);
  });
