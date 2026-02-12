import { apiBaseUrl } from '../../config/env';
import { fetchJson } from '../../lib/api';

export interface HealthResponse {
  status: string;
  service: string;
  time: string;
  version?: string;
}

export function getHealth(): Promise<HealthResponse> {
  return fetchJson<HealthResponse>(`${apiBaseUrl}/api/v1/health`);
}
