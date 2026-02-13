import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

export function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function setStoredToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function removeStoredToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
