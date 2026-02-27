import { buildUrl, fetchJson } from '../../lib/api';
import type { LoginResponse, MeResponse, RefreshResponse, RegisterResponse, SessionItem } from '../../types/api';

interface DeviceInfo {
  deviceId?: string;
  deviceName?: string | null;
  platform?: string;
  appVersion?: string;
}

export function postRegister(
  email: string,
  password: string,
  username: string,
): Promise<RegisterResponse> {
  return fetchJson<RegisterResponse>(buildUrl('/api/v1/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username }),
  });
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

/** Request a password reset email. Always resolves (anti-enumeration). */
export function postPasswordResetRequest(email: string): Promise<void> {
  return fetchJson<void>(buildUrl('/api/v1/auth/password/reset/request'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/** Confirm password reset with the token from the email and the new password. */
export function postPasswordResetConfirm(token: string, newPassword: string): Promise<void> {
  return fetchJson<void>(buildUrl('/api/v1/auth/password/reset/confirm'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
}

/** Change password while logged in. Bearer auto-added. */
export function postPasswordChange(currentPassword: string, newPassword: string): Promise<void> {
  return fetchJson<void>(buildUrl('/api/v1/auth/password/change'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/** List active sessions. Bearer auto-added. */
export function getSessions(): Promise<SessionItem[]> {
  return fetchJson<SessionItem[]>(buildUrl('/api/v1/auth/sessions'));
}

/** Revoke a session by ID. Bearer auto-added. */
export function deleteSession(sessionId: string): Promise<void> {
  return fetchJson<void>(buildUrl(`/api/v1/auth/sessions/${sessionId}`), {
    method: 'DELETE',
  });
}
