import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Device from 'expo-device';
import * as Constants from 'expo-constants';
import {
  getMe,
  postLogin,
  postLogout,
  postRefresh,
} from '../features/auth/authClient';
import {
  getOrCreateDeviceId,
  getStoredRefreshToken,
  removeStoredRefreshToken,
  removeStoredToken,
  setStoredRefreshToken,
  STORAGE_BACKEND,
} from '../lib/token-store';
import {
  clearAuthInterceptor,
  configureAuthInterceptor,
  setAccessToken,
} from '../lib/api';
import type { MeResponse } from '../types/api';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Current access token (in-memory). Exposed for socket connections. */
  token: string | null;
  user: MeResponse | null;
}

interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string) => Promise<void>;
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

  // ── Callbacks wired into the HTTP interceptor ──

  /**
   * Called by the fetchJson interceptor on 401.
   * Reads the stored refresh token, calls /auth/refresh, updates in-memory
   * access token + SecureStore, and updates context state (so sockets reconnect
   * with the fresh token).
   */
  const doRefresh = useCallback(async (): Promise<string | null> => {
    const stored = await getStoredRefreshToken();
    if (!stored) return null;
    // postRefresh throws on network errors or 401/REFRESH_REUSED.
    const res = await postRefresh(stored);
    setAccessToken(res.accessToken);
    await setStoredRefreshToken(res.refreshToken);
    // Keep context token in sync so socket.ts picks up the new token on reconnect.
    setState(prev => ({ ...prev, token: res.accessToken }));
    return res.accessToken;
  }, []);

  /**
   * Called when refresh fails (expired, reused, revoked).
   * Clears all local state and navigates to Login via the navigator conditional.
   */
  const handleAuthFailure = useCallback(() => {
    clearAuthInterceptor();
    void removeStoredRefreshToken().catch(() => {});
    void removeStoredToken().catch(() => {}); // clean up legacy key too
    queryClient.clear();
    setState({ isLoading: false, isAuthenticated: false, token: null, user: null });
  }, [queryClient]);

  // ── Bootstrap + interceptor setup ──

  useEffect(() => {
    let cancelled = false;

    // Configure interceptor immediately so any in-flight requests get refresh support.
    configureAuthInterceptor(doRefresh, handleAuthFailure);

    (async () => {
      let refreshToken: string | null = null;
      try {
        refreshToken = await getStoredRefreshToken();
      } catch {
        // SecureStore unavailable — treat as no session.
      }

      if (__DEV__) {
        console.log('[Auth] boot', {
          platform: Platform.OS,
          hasRefreshToken: !!refreshToken,
          storageBackend: STORAGE_BACKEND,
        });
      }

      if (!refreshToken) {
        if (!cancelled) setState({ isLoading: false, isAuthenticated: false, token: null, user: null });
        return;
      }

      try {
        const res = await postRefresh(refreshToken);
        if (cancelled) return;
        setAccessToken(res.accessToken);
        await setStoredRefreshToken(res.refreshToken);
        const user = await getMe();
        if (!cancelled) {
          setState({ isLoading: false, isAuthenticated: true, token: res.accessToken, user });
        }
      } catch {
        // Refresh failed (token expired, revoked, network error) — clear and show login.
        if (!cancelled) {
          void removeStoredRefreshToken().catch(() => {});
          void removeStoredToken().catch(() => {});
          setAccessToken(null);
          setState({ isLoading: false, isAuthenticated: false, token: null, user: null });
        }
      }
    })();

    return () => {
      cancelled = true;
      clearAuthInterceptor();
    };
  }, [doRefresh, handleAuthFailure]);

  // ── Login ──

  const login = useCallback(async (identifier: string, password: string) => {
    const deviceId = await getOrCreateDeviceId().catch(() => undefined);
    const res = await postLogin(identifier, password, {
      deviceId,
      platform: Platform.OS,
      deviceName: Device.deviceName ?? undefined,
      appVersion: Constants.default.expoConfig?.version,
    });

    setAccessToken(res.accessToken);
    await setStoredRefreshToken(res.refreshToken);

    const user = await getMe();
    setState({ isLoading: false, isAuthenticated: true, token: res.accessToken, user });
  }, []);

  // ── Logout ──

  const logout = useCallback(async () => {
    // Best-effort server-side revocation — don't block on failure.
    try {
      await postLogout();
    } catch {
      // Token may already be expired or revoked; local cleanup still proceeds.
    }
    clearAuthInterceptor();
    await Promise.all([
      removeStoredRefreshToken().catch(() => {}),
      removeStoredToken().catch(() => {}),
    ]);
    queryClient.clear();
    setState({ isLoading: false, isAuthenticated: false, token: null, user: null });
  }, [queryClient]);

  // ──

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
