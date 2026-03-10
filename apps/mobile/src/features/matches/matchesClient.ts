import { buildUrl, fetchJson } from '../../lib/api';
import type { CreateMatchResponse, GetInviteCandidatesResponse, GetMatchAuditLogsResponse, GetMatchResponse, ListMatchesResponse, MatchSnapshot, SearchVenuePitchesResponse } from '../../types/api';

interface ListParams {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  view?: 'upcoming' | 'history';
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
  payload: {
    title: string;
    startsAt: string;
    capacity: number;
    venueId?: string;
    venuePitchId?: string;
  },
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

export function searchVenuePitches(
  token: string,
  pitchType: string,
): Promise<SearchVenuePitchesResponse> {
  return fetchJson<SearchVenuePitchesResponse>(
    buildUrl('/api/v1/venue-pitches/search', { pitchType }),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function postMatchAction(
  token: string,
  matchId: string,
  action: string,
  expectedRevision: number,
  idempotencyKey: string,
): Promise<MatchSnapshot> {
  return fetchJson<MatchSnapshot>(buildUrl(`/api/v1/matches/${matchId}/${action}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ expectedRevision }),
  });
}

export function inviteToMatch(
  token: string,
  matchId: string,
  identifier: string,
  expectedRevision: number,
  idempotencyKey: string,
): Promise<MatchSnapshot> {
  return fetchJson<MatchSnapshot>(buildUrl(`/api/v1/matches/${matchId}/invite`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ identifier, expectedRevision }),
  });
}

export function patchMatch(
  token: string,
  matchId: string,
  body: Record<string, unknown> & { expectedRevision: number },
): Promise<MatchSnapshot> {
  return fetchJson<MatchSnapshot>(buildUrl(`/api/v1/matches/${matchId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

export function promoteAdmin(
  token: string,
  matchId: string,
  userId: string,
  expectedRevision: number,
): Promise<MatchSnapshot> {
  return fetchJson<MatchSnapshot>(buildUrl(`/api/v1/matches/${matchId}/admins`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, expectedRevision }),
  });
}

export function getMatchAuditLogs(
  token: string,
  matchId: string,
  params?: { page?: number; pageSize?: number },
): Promise<GetMatchAuditLogsResponse> {
  return fetchJson<GetMatchAuditLogsResponse>(
    buildUrl(`/api/v1/matches/${matchId}/audit-logs`, params as Record<string, string | number | undefined>),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function demoteAdmin(
  token: string,
  matchId: string,
  userId: string,
  expectedRevision: number,
): Promise<MatchSnapshot> {
  return fetchJson<MatchSnapshot>(buildUrl(`/api/v1/matches/${matchId}/admins/${userId}`), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ expectedRevision }),
  });
}

export function getInviteCandidates(
  token: string,
  matchId: string,
  groupId: string,
): Promise<GetInviteCandidatesResponse> {
  return fetchJson<GetInviteCandidatesResponse>(
    buildUrl(`/api/v1/matches/${matchId}/invite-candidates`, { groupId }),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function kickParticipant(
  token: string,
  matchId: string,
  userId: string,
  expectedRevision: number,
): Promise<MatchSnapshot> {
  return fetchJson<MatchSnapshot>(buildUrl(`/api/v1/matches/${matchId}/kick`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, expectedRevision }),
  });
}

export function saveTeams(
  token: string,
  matchId: string,
  body: { expectedRevision: number; teamA: (string | null)[]; teamB: (string | null)[] },
): Promise<MatchSnapshot> {
  return fetchJson<MatchSnapshot>(buildUrl(`/api/v1/matches/${matchId}/teams`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

export function blockTeamAutoGen(token: string, matchId: string): Promise<void> {
  return fetchJson<void>(buildUrl(`/api/v1/matches/${matchId}/teams/block-autogen`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function generateBalancedTeams(
  token: string,
  matchId: string,
  expectedRevision: number,
): Promise<MatchSnapshot> {
  return fetchJson<MatchSnapshot>(buildUrl(`/api/v1/matches/${matchId}/teams/generate-balanced`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ expectedRevision }),
  });
}
