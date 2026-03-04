import { buildUrl, fetchJson } from '../../lib/api';

interface RegisterDevicePayload {
  expoPushToken: string;
  platform: 'ios' | 'android';
  deviceName?: string;
  deviceId?: string;
}

interface RegisterDeviceResponse {
  id: string;
  expoPushToken: string;
  platform: string;
  disabledAt: string | null;
}

export function registerPushDevice(
  token: string,
  payload: RegisterDevicePayload,
): Promise<RegisterDeviceResponse> {
  return fetchJson<RegisterDeviceResponse>(buildUrl('/api/v1/push/devices/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

interface PushDeviceItem {
  id: string;
  platform: string;
  deviceName: string | null;
  deviceId: string | null;
  lastSeenAt: string;
  disabledAt: string | null;
}

interface GetPushDevicesResponse {
  devices: PushDeviceItem[];
}

export function getPushDevices(): Promise<GetPushDevicesResponse> {
  return fetchJson<GetPushDevicesResponse>(buildUrl('/api/v1/push/devices'));
}
