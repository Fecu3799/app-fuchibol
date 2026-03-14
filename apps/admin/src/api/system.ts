import { apiFetch } from './client';

export interface SystemHealth {
  db: { status: 'ok' | 'error' };
  cron: { status: 'ok' | 'stale' | 'unknown'; lastTickAt: string | null };
  notifications: { deliveredL1h: number; disabledDevices: number };
}

export function getSystemHealth(): Promise<SystemHealth> {
  return apiFetch<SystemHealth>('/admin/system/health');
}
