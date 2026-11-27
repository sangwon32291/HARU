import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Profile, SignUpInput } from '@/types/database';
import * as authService from '@/services/auth';
import type { Result } from '@/services/types';

interface AuthContextValue {
  user: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<Result<Profile>>;
  signUp: (input: SignUpInput) => Promise<Result<Profile>>;
  signOut: () => Promise<void>;
  updateProfile: (input: Parameters<typeof authService.updateProfile>[0]) => Promise<Result<Profile>>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(await authService.getCurrentUser());
  }, []);

  useEffect(() => {
    // 세션 복원 (AUTH-02: 새로고침 후에도 로그인 유지)
    let alive = true;
    authService.getCurrentUser().then((u) => {
      if (!alive) return;
      setUser(u);
      setLoading(false);
    });
    // 다른 탭에서 로그아웃하거나 토큰이 갱신되면 화면 상태를 맞춘다(supabase 모드).
    const unsubscribe = authService.onAuthChange(() => {
      authService.getCurrentUser().then((u) => alive && setUser(u));
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authService.signIn(email, password);
    if (result.data) setUser(result.data);
    return result;
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const result = await authService.signUp(input);
    if (result.data) setUser(result.data);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (input: Parameters<typeof authService.updateProfile>[0]) => {
    const result = await authService.updateProfile(input);
    if (result.data) setUser(result.data);
    return result;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      signIn,
      signUp,
      signOut,
      updateProfile,
      refresh,
    }),
    [user, loading, signIn, signUp, signOut, updateProfile, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}
