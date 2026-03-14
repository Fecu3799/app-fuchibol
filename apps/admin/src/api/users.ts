import { apiFetch } from './client';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  matchCount: number;
  pushTokenCount: number;
}

export interface AdminUserDetail extends AdminUser {
  pushTokens: Array<{ token: string; platform: string; createdAt: string }>;
  recentMatches: Array<{ id: string; title: string; status: string; startsAt: string }>;
}

export interface UsersPage {
  items: AdminUser[];
  pageInfo: { total: number; page: number; pageSize: number };
}

export function listUsers(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<UsersPage> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('pageSize', String(params.pageSize));
  return apiFetch<UsersPage>(`/admin/users?${q.toString()}`);
}

export function getUser(id: string): Promise<AdminUserDetail> {
  return apiFetch<AdminUserDetail>(`/admin/users/${id}`);
}

export function banUser(id: string, reason: string): Promise<void> {
  return apiFetch<void>(`/admin/users/${id}/ban`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function unbanUser(id: string): Promise<void> {
  return apiFetch<void>(`/admin/users/${id}/unban`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
