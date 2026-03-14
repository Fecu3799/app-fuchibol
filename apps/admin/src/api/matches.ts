import { apiFetch } from './client';

export interface AdminMatch {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  capacity: number;
  confirmedCount: number;
  creatorUsername: string;
  venueName: string | null;
}

export interface AdminMatchDetail {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  revision: number;
  creatorId: string;
  creatorUsername: string;
  venueName: string | null;
  pitchType: string | null;
  participants: Array<{
    userId: string;
    username: string;
    status: string;
    isMatchAdmin: boolean;
    confirmedAt: string | null;
  }>;
  auditLogs: Array<{
    id: string;
    type: string;
    actorId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  notificationDeliveries: Array<{
    id: string;
    userId: string;
    type: string;
    bucket: string | null;
    createdAt: string;
  }>;
}

export interface MatchesPage {
  items: AdminMatch[];
  pageInfo: { total: number; page: number; pageSize: number };
}

export function listMatches(params: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<MatchesPage> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.dateFrom) q.set('dateFrom', params.dateFrom);
  if (params.dateTo) q.set('dateTo', params.dateTo);
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('pageSize', String(params.pageSize));
  return apiFetch<MatchesPage>(`/admin/matches?${q.toString()}`);
}

export function getMatch(id: string): Promise<AdminMatchDetail> {
  return apiFetch<AdminMatchDetail>(`/admin/matches/${id}`);
}

export function cancelMatch(id: string): Promise<void> {
  return apiFetch<void>(`/admin/matches/${id}/cancel`, { method: 'POST', body: '{}' });
}

export function deleteMatch(id: string): Promise<void> {
  return apiFetch<void>(`/admin/matches/${id}`, { method: 'DELETE' });
}

export function unlockMatch(id: string): Promise<void> {
  return apiFetch<void>(`/admin/matches/${id}/unlock`, { method: 'POST', body: '{}' });
}
