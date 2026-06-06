import * as SecureStore from 'expo-secure-store';
import { Config } from '@/constants/config';

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(Config.TOKEN_KEYS.ACCESS, accessToken),
    SecureStore.setItemAsync(Config.TOKEN_KEYS.REFRESH, refreshToken),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(Config.TOKEN_KEYS.ACCESS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(Config.TOKEN_KEYS.REFRESH);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(Config.TOKEN_KEYS.ACCESS),
    SecureStore.deleteItemAsync(Config.TOKEN_KEYS.REFRESH),
  ]);
}
