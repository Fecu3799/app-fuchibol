import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { registerPushDevice } from './pushClient';

const STORE_KEY_PUSH_ENABLED = 'push_enabled';
const STORE_KEY_PUSH_TOKEN = 'push_token';

type PushStatus = 'idle' | 'requesting' | 'registered' | 'denied' | 'error';

interface UsePushNotificationsResult {
  status: PushStatus;
  expoPushToken: string | null;
  /** Call this from the Settings "Enable notifications" button. */
  requestAndRegister: () => Promise<void>;
  isSupported: boolean;
}

async function storeValue(key: string, value: string) {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch {}
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
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
  const { token: authToken } = useAuth();
  const [status, setStatus] = useState<PushStatus>('idle');
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  // Push notifications are not supported on web or simulators.
  const isSupported = Platform.OS !== 'web' && Device.isDevice;

  // On mount, restore previously registered token from storage.
  useEffect(() => {
    if (!isSupported) return;
    getStoredValue(STORE_KEY_PUSH_TOKEN).then((storedToken) => {
      if (storedToken) {
        setExpoPushToken(storedToken);
        setStatus('registered');
      }
    });
  }, [isSupported]);

  const requestAndRegister = useCallback(async () => {
    if (!isSupported || !authToken) return;

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

      await registerPushDevice(authToken, {
        expoPushToken: pushToken,
        platform: Platform.OS as 'ios' | 'android',
        deviceName: Device.deviceName ?? undefined,
      });

      await storeValue(STORE_KEY_PUSH_ENABLED, 'true');
      await storeValue(STORE_KEY_PUSH_TOKEN, pushToken);

      setExpoPushToken(pushToken);
      setStatus('registered');
    } catch (err) {
      console.error('[usePushNotifications] Error:', err);
      setStatus('error');
    }
  }, [isSupported, authToken]);

  return { status, expoPushToken, requestAndRegister, isSupported };
}
