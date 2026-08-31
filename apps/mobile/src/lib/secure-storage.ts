/**
 * Token storage: the device keychain on native, `localStorage` on web.
 *
 * Follows the pattern in Expo's Expo Router authentication guide, with two
 * deviations that matter for this app:
 *
 *   - `AFTER_FIRST_UNLOCK` keychain accessibility, so a launch triggered while
 *     the device is locked (a meeting-reminder push, once the queue work in
 *     docs/IMPLEMENTATION_PLAN.md section 3 lands) can still read the refresh token.
 *   - Writes are guarded. SecureStore surfaces native errors, and iOS has
 *     historically rejected values over ~2048 bytes. A JWT with a fat claim set
 *     can approach that, and a throw here would otherwise take down sign-in.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      // Private browsing and blocked-cookie modes throw on access.
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch {
    return null;
  }
}

export async function setSecureItem(key: string, value: string | null): Promise<void> {
  if (isWeb) {
    try {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } catch {
      // Non-fatal: the session survives in memory for this app run.
    }
    return;
  }
  try {
    if (value === null) await SecureStore.deleteItemAsync(key, OPTIONS);
    else await SecureStore.setItemAsync(key, value, OPTIONS);
  } catch {
    // Same reasoning as web: losing persistence is worse than crashing sign-in,
    // but not by enough to justify taking the screen down.
  }
}
