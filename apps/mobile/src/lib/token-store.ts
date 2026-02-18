import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

const isWeb = Platform.OS === 'web';

function webStorageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export const STORAGE_BACKEND = isWeb ? 'localStorage' : 'secureStore';

export async function getStoredToken(): Promise<string | null> {
  if (isWeb) {
    return webStorageAvailable() ? localStorage.getItem(TOKEN_KEY) : null;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  if (isWeb) {
    if (webStorageAvailable()) localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeStoredToken(): Promise<void> {
  if (isWeb) {
    if (webStorageAvailable()) localStorage.removeItem(TOKEN_KEY);
    return;
  }
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
