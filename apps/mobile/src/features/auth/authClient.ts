import { buildUrl, fetchJson } from '../../lib/api';
import type { LoginResponse, MeResponse, RefreshResponse } from '../../types/api';

interface DeviceInfo {
  deviceId?: string;
  deviceName?: string | null;
  platform?: string;
  appVersion?: string;
}

export function postLogin(
  identifier: string,
  password: string,
  device?: DeviceInfo,
): Promise<LoginResponse> {
  return fetchJson<LoginResponse>(buildUrl('/api/v1/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password, device }),
  });
}

export function postRefresh(refreshToken: string): Promise<RefreshResponse> {
  return fetchJson<RefreshResponse>(buildUrl('/api/v1/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}

/** Bearer token auto-added by fetchJson interceptor. */
export function postLogout(): Promise<void> {
  return fetchJson<void>(buildUrl('/api/v1/auth/logout'), { method: 'POST' });
}

export function postLogoutAll(): Promise<void> {
  return fetchJson<void>(buildUrl('/api/v1/auth/logout-all'), { method: 'POST' });
}

/** GET /api/v1/me — uses the auto-injected Bearer from the interceptor. */
export function getMe(): Promise<MeResponse> {
  return fetchJson<MeResponse>(buildUrl('/api/v1/me'));
}

/** Request a verification email. Pass the user's email address. */
export function postEmailVerifyRequest(email: string): Promise<void> {
  return fetchJson<void>(buildUrl('/api/v1/auth/email/verify/request'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/** Confirm email verification with the token received by email. */
export function postEmailVerifyConfirm(token: string): Promise<void> {
  return fetchJson<void>(buildUrl('/api/v1/auth/email/verify/confirm'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}
