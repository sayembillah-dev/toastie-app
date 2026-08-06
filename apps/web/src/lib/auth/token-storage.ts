/** Access + refresh token storage and the active-context key. All reads
 * return `null` on the server, so nothing hits `window` outside the
 * browser. `SessionProvider` reads from here inside its `useEffect` so
 * the first client render is deterministic. */

export const ACCESS_TOKEN_KEY = 'toastly.auth.access';
export const REFRESH_TOKEN_KEY = 'toastly.auth.refresh';
export const ACTIVE_CONTEXT_KEY = 'toastly.activeContext';

/** localStorage keys the app persists — the store's cross-tab listener
 * (`store-provider.tsx`) reacts to changes on this set. Any other key
 * (analytics ids, feature flags, etc.) is ignored. */
export const AUTH_STORAGE_KEYS: readonly string[] = [
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  ACTIVE_CONTEXT_KEY,
];

function readLocal(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function writeLocal(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
}

export function readAccessToken(): string | null {
  return readLocal(ACCESS_TOKEN_KEY);
}

export function writeAccessToken(token: string | null): void {
  writeLocal(ACCESS_TOKEN_KEY, token);
}

export function readRefreshToken(): string | null {
  return readLocal(REFRESH_TOKEN_KEY);
}

export function writeRefreshToken(token: string | null): void {
  writeLocal(REFRESH_TOKEN_KEY, token);
}

/** The serialized active-context key — `club:<id>`, `area:<id>`,
 * `division:<id>`, `district:<id>` or `global`. Written on context change and
 * validated on every page load. */
export function readStoredContext(): string | null {
  return readLocal(ACTIVE_CONTEXT_KEY);
}

export function writeStoredContext(key: string | null): void {
  writeLocal(ACTIVE_CONTEXT_KEY, key);
}

export function clearAuthStorage(): void {
  writeLocal(ACCESS_TOKEN_KEY, null);
  writeLocal(REFRESH_TOKEN_KEY, null);
  writeLocal(ACTIVE_CONTEXT_KEY, null);
}
