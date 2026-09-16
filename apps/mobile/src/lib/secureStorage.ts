/**
 * Auth session storage for supabase-js.
 * expo-secure-store warns above 2048 bytes per value and a session with provider tokens can exceed
 * that, so values are split into chunks. If SecureStore is unavailable (simulator quirks, web, tests)
 * the adapter falls back to AsyncStorage so sign-in still works.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const COUNT_SUFFIX = '__chunks';

function chunkKey(key: string, index: number): string {
  return `${key}__${index}`;
}

let secureAvailable: Promise<boolean> | null = null;
function isSecureAvailable(): Promise<boolean> {
  if (!secureAvailable) {
    secureAvailable = SecureStore.isAvailableAsync().catch(() => false);
  }
  return secureAvailable;
}

async function secureGet(key: string): Promise<string | null> {
  const countRaw = await SecureStore.getItemAsync(key + COUNT_SUFFIX);
  if (!countRaw) {
    return SecureStore.getItemAsync(key);
  }
  const count = Number(countRaw);
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function secureRemove(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(key + COUNT_SUFFIX);
  if (countRaw) {
    const count = Number(countRaw);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
    await SecureStore.deleteItemAsync(key + COUNT_SUFFIX);
  }
  await SecureStore.deleteItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  await secureRemove(key);
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const count = Math.ceil(value.length / CHUNK_SIZE);
  for (let i = 0; i < count; i += 1) {
    await SecureStore.setItemAsync(
      chunkKey(key, i),
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    );
  }
  await SecureStore.setItemAsync(key + COUNT_SUFFIX, String(count));
}

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (await isSecureAvailable()) {
      try {
        return await secureGet(key);
      } catch {
        // fall through to AsyncStorage
      }
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (await isSecureAvailable()) {
      try {
        await secureSet(key, value);
        await AsyncStorage.removeItem(key);
        return;
      } catch {
        // fall through to AsyncStorage
      }
    }
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (await isSecureAvailable()) {
      try {
        await secureRemove(key);
      } catch {
        // ignore
      }
    }
    await AsyncStorage.removeItem(key);
  },
};
