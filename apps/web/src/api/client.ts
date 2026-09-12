import type { ApiError, AuthSession } from '@balsanskar/shared';

/**
 * The single place the browser talks to the API.
 *
 * Three behaviours that matter on the connections these users actually have:
 *
 *   - a refresh in flight is shared, so ten components mounting at once produce
 *     one refresh, not ten (ten would trip the reuse detector and sign the
 *     teacher out);
 *   - every request carries a timeout, because a stalled 2G socket otherwise
 *     leaves a spinner up forever;
 *   - a network failure is reported as a distinct kind of error, so callers can
 *     offer the offline outbox rather than a generic "something went wrong".
 */

const ACCESS_KEY = 'balsanskar.access';
const REFRESH_KEY = 'balsanskar.refresh';

/**
 * Tokens live in localStorage.
 *
 * The honest trade: this is readable by script, so a cross-site scripting bug
 * would expose a session. Against that, the API and the app are deployed on
 * different origins in the pilot (and possibly on different departments'
 * infrastructure), which rules out a host-only cookie without a reverse proxy
 * in front of both. The mitigations are a 15-minute access token, refresh
 * rotation with theft detection, and a strict content security policy on the
 * static host. If the deployment is ever collapsed behind one origin, move
 * these to `Secure; HttpOnly; SameSite=Strict` cookies and delete this comment.
 */
export const tokenStore = {
  get access(): string | null {
    try {
      return localStorage.getItem(ACCESS_KEY);
    } catch {
      return null;
    }
  },
  get refresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set(session: AuthSession['tokens']): void {
    try {
      localStorage.setItem(ACCESS_KEY, session.accessToken);
      localStorage.setItem(REFRESH_KEY, session.refreshToken);
    } catch {
      // Storage denied: the session lives for this tab only.
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
}

/** Distinguishes "the network is gone" from "the server said no". */
export class NetworkError extends Error {
  constructor(message = 'network unavailable') {
    super(message);
    this.name = 'NetworkError';
  }
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
const REQUEST_TIMEOUT_MS = 30_000;

type Listener = () => void;
const signedOutListeners = new Set<Listener>();

/** Fires when the session is gone for good and the app must return to sign-in. */
export function onSignedOut(listener: Listener): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

function announceSignedOut(): void {
  tokenStore.clear();
  for (const listener of signedOutListeners) listener();
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const refreshToken = tokenStore.refresh;
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) return false;
      const session = (await response.json()) as AuthSession;
      tokenStore.set(session.tokens);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so concurrent callers all observe this result.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();
  return refreshInFlight;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skips the Authorization header and the refresh dance. */
  anonymous?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (!options.anonymous) {
      const token = tokenStore.access;
      if (token) headers.authorization = `Bearer ${token}`;
    }

    const timeout = AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    try {
      return await fetch(`${BASE_URL}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new NetworkError(error instanceof Error ? error.message : undefined);
    }
  };

  let response = await send();

  // One retry after a refresh. Never more: a second 401 means the session is
  // genuinely finished, and looping would hammer the endpoint.
  if (response.status === 401 && !options.anonymous) {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      announceSignedOut();
      throw new ApiRequestError(
        401,
        'UNAUTHENTICATED',
        'Your session has ended. Please sign in again.',
      );
    }
    response = await send();
    if (response.status === 401) {
      announceSignedOut();
    }
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const payload = (await response.json().catch(() => null)) as ApiError | null;
      throw new ApiRequestError(
        response.status,
        payload?.error.code ?? 'INTERNAL_ERROR',
        payload?.error.message ?? 'Request failed',
        payload?.error.fields,
      );
    }
    throw new ApiRequestError(
      response.status,
      'INTERNAL_ERROR',
      `Request failed (${response.status})`,
    );
  }

  if (contentType.includes('application/json')) return (await response.json()) as T;
  return (await response.text()) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Sends the bytes of a file straight to storage using an upload ticket.
 *
 * Kept out of `apiRequest` because it must not carry the Authorization header:
 * the ticket URL is already signed, and an S3 presigned URL rejects a request
 * that also presents a bearer token.
 */
export async function uploadToTicket(
  ticket: { uploadUrl: string; method: 'PUT' | 'POST'; headers: Record<string, string> },
  file: Blob,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(ticket.uploadUrl, {
      method: ticket.method,
      headers: ticket.headers,
      body: file,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined);
  }
  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      'UPLOAD_FAILED',
      'The photograph could not be uploaded',
    );
  }
}
