import { buildUrl, fetchJson } from '../../lib/api';
import type { UserSettings } from '../../types/api';

export function getUserSettings(): Promise<UserSettings> {
  return fetchJson<UserSettings>(buildUrl('/api/v1/users/me/settings'));
}

export function patchUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  return fetchJson<UserSettings>(buildUrl('/api/v1/users/me/settings'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}
