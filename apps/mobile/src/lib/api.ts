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

  /** Stable error code from backend (e.g. REVISION_CONFLICT, MATCH_LOCKED). */
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

export async function fetchJson<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const requestId = randomUUID();

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init?.headers as Record<string, string>),
      'X-Request-Id': requestId,
    };

    const res = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      let body: ApiErrorBody;
      try {
        body = await res.json();
      } catch {
        body = { status: res.status, message: res.statusText };
      }
      // Ensure requestId is always present
      if (!body.requestId) body.requestId = requestId;
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
