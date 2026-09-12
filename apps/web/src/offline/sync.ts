import type { ActivityDetail, UploadTicket } from '@balsanskar/shared';
import { NetworkError, api, uploadToTicket } from '../api/client.js';
import {
  MAX_ATTEMPTS,
  listQueued,
  markAttempt,
  removeQueued,
  type QueuedActivity,
} from './outbox.js';

/**
 * Drains the outbox.
 *
 * Runs when the browser reports the network is back, when the app is opened,
 * and on a slow interval. One item at a time: these are 2G uplinks, and sending
 * five photograph uploads in parallel makes all five fail.
 */

let draining = false;

export interface SyncResult {
  sent: number;
  failed: number;
  remaining: number;
}

export async function drainOutbox(): Promise<SyncResult> {
  if (draining) return { sent: 0, failed: 0, remaining: await pending() };
  draining = true;
  let sent = 0;
  let failed = 0;

  try {
    const queued = await listQueued();
    for (const entry of queued) {
      if (entry.attempts >= MAX_ATTEMPTS) {
        failed += 1;
        continue;
      }
      try {
        await sendOne(entry);
        await removeQueued(entry.id);
        sent += 1;
      } catch (error) {
        // A network failure is not the teacher's problem and does not count as
        // an attempt worth burning — stop and try the whole queue again later.
        if (error instanceof NetworkError) break;
        await markAttempt(entry, error instanceof Error ? error.message : 'unknown error');
        failed += 1;
      }
    }
  } finally {
    draining = false;
  }

  return { sent, failed, remaining: await pending() };
}

async function pending(): Promise<number> {
  return (await listQueued()).filter((entry) => entry.attempts < MAX_ATTEMPTS).length;
}

async function sendOne(entry: QueuedActivity): Promise<void> {
  const mediaKeys: string[] = [];
  for (const photo of entry.photos) {
    const ticket = await api.post<UploadTicket>('/v1/uploads', {
      fileName: 'photo.jpg',
      contentType: photo.type === 'image/png' ? 'image/png' : 'image/jpeg',
      sizeBytes: photo.size,
      purpose: 'ACTIVITY_MEDIA',
    });
    await uploadToTicket(ticket, photo);
    mediaKeys.push(ticket.key);
  }
  await api.post<ActivityDetail>('/v1/activities', { ...entry.payload, mediaKeys });
}

/**
 * Starts the background drain.
 *
 * The interval is deliberately long. A teacher's phone should not be woken
 * every thirty seconds to poll a network that is not there; the `online` event
 * does the real work and the timer is only a safety net for the case where the
 * browser never fires it.
 */
export function startOutboxSync(onResult?: (result: SyncResult) => void): () => void {
  const run = () => {
    void drainOutbox().then((result) => {
      if (result.sent > 0 || result.failed > 0) onResult?.(result);
    });
  };

  const handleOnline = () => run();
  window.addEventListener('online', handleOnline);
  const timer = window.setInterval(() => {
    if (navigator.onLine) run();
  }, 120_000);

  if (navigator.onLine) run();

  return () => {
    window.removeEventListener('online', handleOnline);
    window.clearInterval(timer);
  };
}
