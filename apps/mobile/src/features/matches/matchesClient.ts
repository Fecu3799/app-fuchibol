import { buildUrl, fetchJson } from '../../lib/api';
import type { CreateMatchResponse, GetMatchResponse, ListMatchesResponse } from '../../types/api';

interface ListParams {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}

export function getMatches(token: string, params?: ListParams): Promise<ListMatchesResponse> {
  return fetchJson<ListMatchesResponse>(buildUrl('/api/v1/matches', params as Record<string, string | number | undefined>), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getMatch(token: string, matchId: string): Promise<GetMatchResponse> {
  return fetchJson<GetMatchResponse>(buildUrl(`/api/v1/matches/${matchId}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createMatch(
  token: string,
  payload: { title: string; startsAt: string; capacity: number },
): Promise<CreateMatchResponse> {
  return fetchJson<CreateMatchResponse>(buildUrl('/api/v1/matches'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function postMatchAction(
  token: string,
  matchId: string,
  action: string,
  expectedRevision: number,
  idempotencyKey: string,
): Promise<GetMatchResponse> {
  return fetchJson<GetMatchResponse>(buildUrl(`/api/v1/matches/${matchId}/${action}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ expectedRevision }),
  });
}
