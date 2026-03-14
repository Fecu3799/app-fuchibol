import { useState, useCallback } from 'react';

const TOKEN_KEY = 'admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(getToken);

  const login = useCallback((t: string) => {
    setToken(t);
    setTokenState(t);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  return { token, login, logout, isAuthenticated: token !== null };
}
