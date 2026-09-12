import { useCallback, useEffect, useRef, useState } from 'react';
import { NetworkError, api } from '../api/client.js';

/**
 * A minimal data-fetching hook.
 *
 * No React Query: it is excellent, and it is roughly 13 KB gzipped plus a
 * mental model, for a handful of screens that each load one list. On the
 * connections this app targets, that trade does not pay. What is kept is the
 * part that actually matters — abort on unmount, an explicit reload, and an
 * error object the caller can distinguish network failures in.
 */
export interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  offline: boolean;
  reload: () => void;
}

export function useApi<T>(path: string | null, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(path !== null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const requestId = ++latest.current;
    setLoading(true);
    setError(null);

    api
      .get<T>(path, { signal: controller.signal })
      .then((result) => {
        // Ignore a response that arrives after a newer request was issued: on a
        // slow link, an earlier query can easily land last.
        if (requestId !== latest.current) return;
        setData(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted || requestId !== latest.current) return;
        setError(caught);
      })
      .finally(() => {
        if (requestId === latest.current) setLoading(false);
      });

    return () => controller.abort();
    // The dependency array is intentionally spread from `deps`: callers decide
    // what a refetch depends on, which the exhaustive-deps rule cannot verify.
  }, [path, nonce, ...deps]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, error, loading, offline: error instanceof NetworkError, reload };
}

export interface PagedResponse<T> {
  items: T[];
  nextCursor: string | null;
}
