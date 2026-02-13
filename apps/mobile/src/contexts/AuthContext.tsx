import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getMe, postLogin } from '../features/auth/authClient';
import {
  getStoredToken,
  removeStoredToken,
  setStoredToken,
} from '../lib/token-store';
import { ApiError } from '../lib/api';
import type { MeResponse } from '../types/api';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  user: MeResponse | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    token: null,
    user: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getStoredToken();
      if (!stored) {
        if (!cancelled) setState({ isLoading: false, isAuthenticated: false, token: null, user: null });
        return;
      }
      try {
        const user = await getMe(stored);
        if (!cancelled) setState({ isLoading: false, isAuthenticated: true, token: stored, user });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await removeStoredToken();
        }
        if (!cancelled) setState({ isLoading: false, isAuthenticated: false, token: null, user: null });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await postLogin(email, password);
    await setStoredToken(res.accessToken);
    const user = await getMe(res.accessToken);
    setState({ isLoading: false, isAuthenticated: true, token: res.accessToken, user });
  }, []);

  const logout = useCallback(async () => {
    await removeStoredToken();
    queryClient.clear();
    setState({ isLoading: false, isAuthenticated: false, token: null, user: null });
  }, [queryClient]);

  const value = useMemo(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
