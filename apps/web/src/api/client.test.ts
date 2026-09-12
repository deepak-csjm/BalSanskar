import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, NetworkError, apiRequest, onSignedOut, tokenStore } from './client.js';

/**
 * The client's error and refresh behaviour.
 *
 * Worth testing directly because the failure modes are invisible in normal use
 * and expensive in production: a refresh storm trips the server's token-reuse
 * detection and signs a whole school out, and a mis-classified network error
 * sends a teacher's activity to an error screen instead of the offline outbox.
 */
describe('api client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('sends the access token and returns the parsed body', async () => {
    tokenStore.set({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresInSeconds: 900,
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await apiRequest<{ ok: boolean }>('/v1/thing');

    expect(result).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer access-1');
  });

  it('turns a JSON error body into an ApiRequestError carrying the field errors', async () => {
    tokenStore.set({ accessToken: 'a', refreshToken: 'r', accessTokenExpiresInSeconds: 900 });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Please check the highlighted fields',
          fields: { title: ['Enter at least 5 characters'] },
        },
      }),
    );

    await expect(apiRequest('/v1/activities', { method: 'POST', body: {} })).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 400,
      code: 'VALIDATION_FAILED',
      fields: { title: ['Enter at least 5 characters'] },
    });
  });

  it('reports a dropped connection as a NetworkError, not a server error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiRequest('/v1/activities', { anonymous: true })).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it('refreshes once and retries after a 401', async () => {
    tokenStore.set({
      accessToken: 'stale',
      refreshToken: 'refresh-1',
      accessTokenExpiresInSeconds: 900,
    });
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          tokens: {
            accessToken: 'fresh',
            refreshToken: 'refresh-2',
            accessTokenExpiresInSeconds: 900,
          },
          user: {},
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await expect(apiRequest<{ ok: boolean }>('/v1/thing')).resolves.toEqual({ ok: true });
    expect(tokenStore.access).toBe('fresh');
    expect(tokenStore.refresh).toBe('refresh-2');
  });

  it('shares one refresh between concurrent requests', async () => {
    tokenStore.set({
      accessToken: 'stale',
      refreshToken: 'refresh-1',
      accessTokenExpiresInSeconds: 900,
    });

    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/v1/auth/refresh')) {
        return Promise.resolve(
          jsonResponse(200, {
            tokens: {
              accessToken: 'fresh',
              refreshToken: 'refresh-2',
              accessTokenExpiresInSeconds: 900,
            },
            user: {},
          }),
        );
      }
      const token = 'stale';
      // Only the stale token is rejected; the retry with the fresh one passes.
      const authHeader = fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined;
      const sent = (authHeader?.headers as Record<string, string> | undefined)?.authorization;
      if (sent === `Bearer ${token}`) {
        return Promise.resolve(
          jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } }),
        );
      }
      return Promise.resolve(jsonResponse(200, { ok: true }));
    });

    await Promise.all([apiRequest('/v1/a'), apiRequest('/v1/b'), apiRequest('/v1/c')]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/v1/auth/refresh'),
    );
    // Three parallel 401s must produce exactly one refresh: more would look
    // like token theft to the server and revoke the whole device family.
    expect(refreshCalls).toHaveLength(1);
  });

  it('clears the session and notifies listeners when the refresh fails', async () => {
    tokenStore.set({
      accessToken: 'stale',
      refreshToken: 'refresh-1',
      accessTokenExpiresInSeconds: 900,
    });
    const signedOut = vi.fn();
    const unsubscribe = onSignedOut(signedOut);

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'gone' } }),
      );

    await expect(apiRequest('/v1/thing')).rejects.toBeInstanceOf(ApiRequestError);
    expect(signedOut).toHaveBeenCalledOnce();
    expect(tokenStore.access).toBeNull();
    unsubscribe();
  });

  it('never sends a token on an anonymous request', async () => {
    tokenStore.set({ accessToken: 'secret', refreshToken: 'r', accessTokenExpiresInSeconds: 900 });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await apiRequest('/v1/public/activities', { anonymous: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('returns undefined for a 204 rather than trying to parse an empty body', async () => {
    tokenStore.set({ accessToken: 'a', refreshToken: 'r', accessTokenExpiresInSeconds: 900 });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiRequest('/v1/thing', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
