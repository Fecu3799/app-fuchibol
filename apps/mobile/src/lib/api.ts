import type { ApiErrorBody } from '../types/api';
import { apiBaseUrl } from '../config/env';

const DEFAULT_TIMEOUT_MS = 12_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
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

export async function fetchJson<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init?.headers as Record<string, string>),
    };
    const hasAuth = 'Authorization' in headers;

    if (__DEV__) {
      console.log(`[api] ${method} ${url} | auth: ${hasAuth ? 'present' : 'absent'}`);
    }

    const res = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (__DEV__) {
      console.log(`[api] ${method} ${url} -> ${res.status}`);
    }

    if (!res.ok) {
      let body: ApiErrorBody;
      try {
        body = await res.json();
      } catch {
        body = { statusCode: res.status, message: res.statusText };
      }
      if (__DEV__) {
        console.log(`[api] ERROR ${res.status}:`, JSON.stringify(body));
      }
      throw new ApiError(res.status, body);
    }

    return (await res.json()) as T;
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
