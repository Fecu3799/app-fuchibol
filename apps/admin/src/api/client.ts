import { getToken, clearToken } from '../auth/useAuth';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
  }

  if (!res.ok) {
    let errorCode = 'UNKNOWN_ERROR';
    try {
      const body = (await res.json()) as { errorCode?: string; message?: string };
      errorCode = body.errorCode ?? errorCode;
      throw new ApiError(res.status, errorCode, body.message ?? res.statusText);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(res.status, errorCode, res.statusText);
    }
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
