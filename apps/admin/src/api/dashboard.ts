import { apiFetch } from './client';

export interface DashboardStats {
  users: {
    total: number;
    activeLast7d: number;
    banned: number;
  };
  matches: {
    today: number;
    tomorrow: number;
    scheduled: number;
  };
  notifications: {
    sentLast24h: number;
  };
}

export function getDashboard(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/admin/dashboard');
}
