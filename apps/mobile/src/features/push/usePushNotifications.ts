import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { registerPushDevice, getPushDevices } from './pushClient';
import { getOrCreateDeviceId } from '../../lib/token-store';

type PushStatus = 'idle' | 'requesting' | 'registered' | 'denied' | 'error';

interface UsePushNotificationsResult {
  status: PushStatus;
  expoPushToken: string | null;
  /** Call this from the Settings "Enable notifications" button. */
  requestAndRegister: () => Promise<void>;
  isSupported: boolean;
}

function resolveProjectId(): string {
  // Priority: easConfig (eas.json / EAS build manifest) > expoConfig.extra.eas (app.json)
  const fromEasConfig = Constants.easConfig?.projectId;
  const fromExtra = (
    Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  )?.eas?.projectId;

  const projectId = fromEasConfig ?? fromExtra;

  if (__DEV__) {
    const source = fromEasConfig
      ? 'Constants.easConfig.projectId'
      : fromExtra
        ? 'Constants.expoConfig.extra.eas.projectId'
        : 'NOT FOUND';
    console.log(`[usePushNotifications] projectId source: ${source} → ${projectId ?? '(none)'}`);
  }

  if (!projectId) {
    throw new Error(
      'Expo projectId not configured. ' +
        'Add your EAS project UUID to app.json under expo.extra.eas.projectId, ' +
        'or run `npx eas init` to link the project.',
    );
  }

  return projectId;
}

async function getExpoPushToken(): Promise<string> {
  const projectId = resolveProjectId();
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { token: authToken, user } = useAuth();
  const [status, setStatus] = useState<PushStatus>('idle');
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  // Push notifications are not supported on web or simulators.
  const isSupported = Platform.OS !== 'web' && Device.isDevice;

  async function fetchAndSetStatus() {
    if (!user?.id) {
      setStatus('idle');
      return;
    }
    try {
      const localDeviceId = await getOrCreateDeviceId();
      const { devices } = await getPushDevices();
      const active = devices.find((d) => d.deviceId === localDeviceId && !d.disabledAt);
      setStatus(active ? 'registered' : 'idle');
    } catch {
      // 401 is handled globally by the interceptor; silently stay idle
      setStatus('idle');
    }
  }

  // Check backend for registration status per user. Re-runs when userId changes.
  useEffect(() => {
    if (!isSupported || !user?.id) {
      setStatus('idle');
      setExpoPushToken(null);
      return;
    }
    void fetchAndSetStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, user?.id]);

  const requestAndRegister = useCallback(async () => {
    if (!isSupported || !authToken || !user?.id) return;

    setStatus('requesting');
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status: requested } = await Notifications.requestPermissionsAsync();
        finalStatus = requested;
      }

      if (finalStatus !== 'granted') {
        setStatus('denied');
        return;
      }

      const pushToken = await getExpoPushToken();
      const localDeviceId = await getOrCreateDeviceId();

      await registerPushDevice(authToken, {
        expoPushToken: pushToken,
        platform: Platform.OS as 'ios' | 'android',
        deviceName: Device.deviceName ?? undefined,
        deviceId: localDeviceId,
      });

      setExpoPushToken(pushToken);
      await fetchAndSetStatus();
    } catch (err) {
      console.error('[usePushNotifications] Error:', err);
      setStatus('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, authToken, user?.id]);

  return { status, expoPushToken, requestAndRegister, isSupported };
}
