import { randomUUID } from 'expo-crypto';
import type { ApiErrorBody } from '../types/api';
import { apiBaseUrl } from '../config/env';

const DEFAULT_TIMEOUT_MS = 12_000;

export class ApiError extends Error {
  public readonly requestId: string | undefined;

  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.detail ?? body.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.requestId = body.requestId;
  }

  /** Stable error code from backend (e.g. REVISION_CONFLICT, EMAIL_NOT_VERIFIED). */
  get code(): string | undefined {
    return this.body.code;
  }
}

export function buildUrl(
  path: string,
  params?: Record<string, string | number | undefined>,
): string {
  const url = `${apiBaseUrl}${path}`;
  if (!params) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const str = qs.toString();
  return str ? `${url}?${str}` : url;
}

// ── In-memory access token + single-flight refresh interceptor ──

let _accessToken: string | null = null;
let _refreshFn: (() => Promise<string | null>) | null = null;
let _onAuthFailure: (() => void) | null = null;
// Only one refresh is allowed in-flight; concurrent 401s join the same promise.
let _refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

/** Call this once on AuthProvider mount to wire up token refresh and failure handling. */
export function configureAuthInterceptor(
  refreshFn: () => Promise<string | null>,
  onAuthFailure: () => void,
): void {
  _refreshFn = refreshFn;
  _onAuthFailure = onAuthFailure;
}

/** Call this on logout or unmount to tear down the interceptor. */
export function clearAuthInterceptor(): void {
  _accessToken = null;
  _refreshFn = null;
  _onAuthFailure = null;
  _refreshPromise = null;
}

/** Single-flight: if a refresh is already in progress all callers await the same promise. */
async function ensureFreshToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  if (!_refreshFn) return null;

  _refreshPromise = _refreshFn()
    .catch(() => {
      _onAuthFailure?.();
      return null;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

// ──

type FetchOptions = RequestInit & {
  timeoutMs?: number;
  /** Internal: prevents infinite 401→refresh→retry loops. Do not set externally. */
  _skipAuthRetry?: boolean;
};

export async function fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, _skipAuthRetry = false, ...init } = options ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const requestId = randomUUID();
  const initHeaders = (init?.headers as Record<string, string>) ?? {};

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...initHeaders,
    'X-Request-Id': requestId,
  };

  // Auto-inject access token unless caller provided an explicit Authorization header.
  if (!initHeaders.Authorization && _accessToken) {
    headers.Authorization = `Bearer ${_accessToken}`;
  }

  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });

    if (!res.ok) {
      let body: ApiErrorBody;
      try {
        body = await res.json();
      } catch {
        body = { status: res.status, message: res.statusText };
      }
      if (!body.requestId) body.requestId = requestId;

      // 401 on a non-auth endpoint → try refresh once, then retry the original request.
      // Skip for all /auth/ URLs (login, refresh, logout, verify) to avoid loops.
      if (
        res.status === 401 &&
        !_skipAuthRetry &&
        !url.includes('/api/v1/auth/')
      ) {
        const newToken = await ensureFreshToken();
        if (newToken) {
          return fetchJson<T>(url, { ...options, _skipAuthRetry: true });
        }
        // Refresh failed — _onAuthFailure already called; fall through to throw.
      }

      throw new ApiError(res.status, body);
    }

    // 204 No Content or empty body → return undefined (caller types it as void).
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
