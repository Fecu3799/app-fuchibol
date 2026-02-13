import { buildUrl, fetchJson } from '../../lib/api';
import type { LoginResponse, MeResponse } from '../../types/api';

export function postLogin(email: string, password: string): Promise<LoginResponse> {
  return fetchJson<LoginResponse>(buildUrl('/api/v1/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(token: string): Promise<MeResponse> {
  return fetchJson<MeResponse>(buildUrl('/api/v1/me'), {
    headers: { Authorization: `Bearer ${token}` },
  });
}
