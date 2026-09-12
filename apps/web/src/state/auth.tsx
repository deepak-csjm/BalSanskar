import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { can, type Permission, type AuthSession, type SessionUser } from '@balsanskar/shared';
import { ApiRequestError, api, onSignedOut, tokenStore } from '../api/client.js';

/**
 * Who is signed in.
 *
 * The permission helper on this context is a convenience for hiding controls a
 * user cannot use. It is not a security boundary — every one of these checks is
 * repeated on the server, and the server's answer is the one that counts. A
 * hidden button and a forbidden endpoint are different things and this codebase
 * treats them that way.
 */

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthValue {
  status: Status;
  user: SessionUser | null;
  signInWithOtp: (phone: string, code: string) => Promise<void>;
  signInWithPassword: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** True when the role carries the permission. Cosmetic only. */
  may: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  const loadCurrentUser = useCallback(async () => {
    if (!tokenStore.access && !tokenStore.refresh) {
      setUser(null);
      setStatus('anonymous');
      return;
    }
    try {
      const me = await api.get<SessionUser>('/v1/auth/me');
      setUser(me);
      setStatus('authenticated');
    } catch (error) {
      // A pending or suspended account gets a 403 with a specific code; the
      // sign-in screen explains it, so the tokens are dropped here.
      if (error instanceof ApiRequestError) {
        tokenStore.clear();
        setUser(null);
        setStatus('anonymous');
        return;
      }
      // A network failure is not a sign-out. Keep the session and let the app
      // show its offline state.
      setStatus(tokenStore.refresh ? 'authenticated' : 'anonymous');
    }
  }, []);

  useEffect(() => {
    void loadCurrentUser();
    return onSignedOut(() => {
      setUser(null);
      setStatus('anonymous');
    });
  }, [loadCurrentUser]);

  const adopt = useCallback((session: AuthSession) => {
    tokenStore.set(session.tokens);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      signInWithOtp: async (phone, code) => {
        adopt(
          await api.post<AuthSession>('/v1/auth/otp/login', { phone, code }, { anonymous: true }),
        );
      },
      signInWithPassword: async (identifier, password) => {
        adopt(
          await api.post<AuthSession>(
            '/v1/auth/password/login',
            { identifier, password },
            { anonymous: true },
          ),
        );
      },
      signOut: async () => {
        const refreshToken = tokenStore.refresh;
        if (refreshToken) {
          // Best effort: the local session ends either way.
          await api.post('/v1/auth/logout', { refreshToken }).catch(() => undefined);
        }
        tokenStore.clear();
        setUser(null);
        setStatus('anonymous');
      },
      refreshUser: loadCurrentUser,
      may: (permission) => (user ? can(user.role, permission) : false),
    }),
    [adopt, loadCurrentUser, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside an AuthProvider');
  return value;
}
