'use client';

import type { AuthUser, LoginBody, LoginResponse, MeResponse } from '@ofix/shared';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { apiFetch, setAccessToken, setOnSessionLost, tryRefresh } from './api';

interface AuthContextValue {
  user: AuthUser | undefined;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (body: LoginBody) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | undefined>(undefined);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  // Session bootstrap: the refresh cookie is the only persistent credential.
  useEffect(() => {
    setOnSessionLost(() => {
      setAccessToken(undefined);
      setUser(undefined);
      setStatus('unauthenticated');
    });
    void (async () => {
      const refreshed = await tryRefresh().catch(() => false);
      if (!refreshed) {
        setStatus('unauthenticated');
        return;
      }
      try {
        const me = await apiFetch<MeResponse>('/auth/me');
        setUser(me.user);
        setStatus('authenticated');
      } catch {
        setStatus('unauthenticated');
      }
    })();
  }, []);

  const login = useCallback(async (body: LoginBody) => {
    const response = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setAccessToken(response.accessToken);
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(undefined);
    setUser(undefined);
    setStatus('unauthenticated');
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, status, login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
