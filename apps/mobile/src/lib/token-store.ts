import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';

const TOKEN_KEY = 'auth_token';          // Legacy access token (kept for cleanup on logout)
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const DEVICE_ID_KEY = 'device_id';

const isWeb = Platform.OS === 'web';

function webStorageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export const STORAGE_BACKEND = isWeb ? 'localStorage' : 'secureStore';

// ── Helpers ──

function webGet(key: string): string | null {
  return webStorageAvailable() ? localStorage.getItem(key) : null;
}
function webSet(key: string, value: string): void {
  if (webStorageAvailable()) localStorage.setItem(key, value);
}
function webDel(key: string): void {
  if (webStorageAvailable()) localStorage.removeItem(key);
}

// ── Legacy access token (used for cleanup on logout) ──

export async function getStoredToken(): Promise<string | null> {
  if (isWeb) return webGet(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  if (isWeb) { webSet(TOKEN_KEY, token); return; }
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeStoredToken(): Promise<void> {
  if (isWeb) { webDel(TOKEN_KEY); return; }
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── Refresh token (SecureStore on native, localStorage on web dev) ──

export async function getStoredRefreshToken(): Promise<string | null> {
  if (isWeb) return webGet(REFRESH_TOKEN_KEY);
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setStoredRefreshToken(token: string): Promise<void> {
  if (isWeb) { webSet(REFRESH_TOKEN_KEY, token); return; }
  return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function removeStoredRefreshToken(): Promise<void> {
  if (isWeb) { webDel(REFRESH_TOKEN_KEY); return; }
  return SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// ── Device ID (generated once, persisted forever) ──

export async function getOrCreateDeviceId(): Promise<string> {
  if (isWeb) {
    const stored = webGet(DEVICE_ID_KEY);
    if (stored) return stored;
    const id = randomUUID();
    webSet(DEVICE_ID_KEY, id);
    return id;
  }
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) return stored;
  const id = randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}
