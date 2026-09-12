import type { CreateActivityInput } from '@balsanskar/shared';

/**
 * The offline outbox.
 *
 * This is the feature that decides whether the platform is usable at all. A
 * teacher records a class activity standing in the school yard, where there is
 * often no signal; the work must not be lost because the network was absent at
 * that moment. Everything is written to IndexedDB first and sent afterwards.
 *
 * IndexedDB rather than localStorage because photographs are Blobs, and because
 * localStorage is synchronous and would jank the UI on a slow phone.
 */

const DB_NAME = 'balsanskar';
const DB_VERSION = 1;
const STORE = 'outbox';

export interface QueuedActivity {
  id: string;
  createdAt: number;
  payload: Omit<CreateActivityInput, 'mediaKeys'>;
  /** Raw photographs, uploaded when the queue drains. */
  photos: Blob[];
  attempts: number;
  lastError?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  } finally {
    db.close();
  }
}

export async function enqueueActivity(
  payload: QueuedActivity['payload'],
  photos: Blob[],
): Promise<string> {
  const entry: QueuedActivity = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    payload,
    photos,
    attempts: 0,
  };
  await withStore('readwrite', (store) => store.add(entry));
  return entry.id;
}

export async function listQueued(): Promise<QueuedActivity[]> {
  const entries = await withStore<QueuedActivity[]>('readonly', (store) => store.getAll());
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

export async function countQueued(): Promise<number> {
  try {
    return await withStore<number>('readonly', (store) => store.count());
  } catch {
    // A browser with IndexedDB disabled still has to render the page.
    return 0;
  }
}

export async function removeQueued(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function markAttempt(entry: QueuedActivity, error: string): Promise<void> {
  await withStore('readwrite', (store) =>
    store.put({ ...entry, attempts: entry.attempts + 1, lastError: error }),
  );
}

/**
 * How many times a queued item is retried before it is left for the teacher to
 * deal with. Kept low on purpose: an item that has failed five times is failing
 * for a reason the network will not fix, and silently retrying forever hides
 * that from the person who needs to know.
 */
export const MAX_ATTEMPTS = 5;
