import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '../api/client.js';
import {
  MAX_ATTEMPTS,
  countQueued,
  enqueueActivity,
  listQueued,
  markAttempt,
  removeQueued,
} from './outbox.js';
import { drainOutbox } from './sync.js';

/**
 * The offline outbox.
 *
 * This is the code that decides whether a teacher's write-up survives a dropped
 * signal, so the tests are about loss: nothing may be dropped silently, and a
 * network failure must not consume a retry that a genuine rejection needs.
 */
describe('offline outbox', () => {
  const payload = {
    title: 'Reading corner set up in class 5',
    description: 'The children built a reading corner from donated books and now read aloud daily.',
    category: 'READING_AND_LIBRARY' as const,
    occurredOn: '2026-02-01',
    classLevels: ['5' as const],
    schemes: [],
    tags: [],
  };

  beforeEach(async () => {
    for (const entry of await listQueued()) await removeQueued(entry.id);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the activity and its photographs when the network is gone', async () => {
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    await enqueueActivity(payload, [photo]);

    const queued = await listQueued();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.payload.title).toBe(payload.title);
    expect(queued[0]?.photos).toHaveLength(1);
    expect(await countQueued()).toBe(1);
  });

  it('preserves the order work was recorded in', async () => {
    await enqueueActivity({ ...payload, title: 'First activity of the day' }, []);
    await new Promise((resolve) => setTimeout(resolve, 2));
    await enqueueActivity({ ...payload, title: 'Second activity of the day' }, []);

    const queued = await listQueued();
    expect(queued.map((entry) => entry.payload.title)).toEqual([
      'First activity of the day',
      'Second activity of the day',
    ]);
  });

  it('sends a queued activity and removes it once accepted', async () => {
    await enqueueActivity(payload, []);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'created' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const result = await drainOutbox();

    expect(result.sent).toBe(1);
    expect(await countQueued()).toBe(0);
  });

  it('stops the drain on a network failure and keeps the work intact', async () => {
    await enqueueActivity(payload, []);
    await enqueueActivity({ ...payload, title: 'Another activity from the same day' }, []);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const result = await drainOutbox();

    expect(result.sent).toBe(0);
    // Nothing is discarded, and no attempt is burned: the network being absent
    // is not the teacher's mistake.
    expect(await countQueued()).toBe(2);
    const queued = await listQueued();
    expect(queued.every((entry) => entry.attempts === 0)).toBe(true);
  });

  it('records an attempt when the server rejects the activity', async () => {
    await enqueueActivity(payload, []);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: 'bad' } }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const result = await drainOutbox();

    expect(result.failed).toBe(1);
    const queued = await listQueued();
    expect(queued[0]?.attempts).toBe(1);
    expect(queued[0]?.lastError).toBeTruthy();
  });

  it('gives up after the retry limit rather than retrying a broken item forever', async () => {
    await enqueueActivity(payload, []);
    let entry = (await listQueued())[0]!;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await markAttempt(entry, 'rejected');
      entry = (await listQueued())[0]!;
    }

    const sendAttempt = vi.fn();
    vi.stubGlobal('fetch', sendAttempt);
    const result = await drainOutbox();

    expect(sendAttempt).not.toHaveBeenCalled();
    // Still on disk so the teacher can see it failed, but no longer counted as
    // pending — a permanent failure should not read as "still sending".
    expect(await countQueued()).toBe(1);
    expect(result.remaining).toBe(0);
  });

  it('classifies a dropped connection as a NetworkError', () => {
    expect(new NetworkError()).toBeInstanceOf(Error);
    expect(new NetworkError().name).toBe('NetworkError');
  });
});
