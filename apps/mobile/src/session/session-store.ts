/**
 * The mutable session state the API client reads, held outside React.
 *
 * Tokens and the active context are not rendering state — the client reads them
 * synchronously in the middle of a request, from code with no component around
 * it. Keeping them in refs meant writing refs during render, which React
 * Compiler (enabled in app.json) is entitled to reorder around. A module-level
 * store is what this actually is.
 *
 * Importing this module configures the API client, so the client is ready
 * before any component mounts and a screen that fetches on mount cannot race it.
 */

import type { TokenBundle } from '@/api';
import { configureApiClient } from '@/api';
import { getSecureItem, setSecureItem } from '@/lib/secure-storage';
import type { ActiveContext } from './context-value';
import { contextKey } from './context-value';

const ACCESS_TOKEN_KEY = 'toastie.accessToken';
const REFRESH_TOKEN_KEY = 'toastie.refreshToken';
export const CONTEXT_STORAGE_KEY = 'toastie.activeContext';

let tokens: TokenBundle | null = null;
let activeContext: ActiveContext | null = null;
let expiredHandler: () => void = () => {};

export async function persistTokens(next: TokenBundle | null): Promise<void> {
  await Promise.all([
    setSecureItem(ACCESS_TOKEN_KEY, next?.accessToken ?? null),
    setSecureItem(REFRESH_TOKEN_KEY, next?.refreshToken ?? null),
  ]);
}

export async function readPersistedTokens(): Promise<TokenBundle | null> {
  const [accessToken, refreshToken] = await Promise.all([
    getSecureItem(ACCESS_TOKEN_KEY),
    getSecureItem(REFRESH_TOKEN_KEY),
  ]);
  // A refresh token alone is enough. The access token is short-lived and the
  // client rotates for a fresh one on the first 401.
  if (!refreshToken) return null;
  return { accessToken: accessToken ?? '', refreshToken };
}

export const sessionStore = {
  getTokens: (): TokenBundle | null => tokens,

  /** Set in memory only — for tokens just read back from storage. */
  setTokensInMemory(next: TokenBundle | null): void {
    tokens = next;
  },

  async setTokens(next: TokenBundle | null): Promise<void> {
    tokens = next;
    await persistTokens(next);
  },

  getContext: (): ActiveContext | null => activeContext,

  setContext(next: ActiveContext | null): void {
    activeContext = next;
  },

  setExpiredHandler(handler: () => void): void {
    expiredHandler = handler;
  },
};

configureApiClient({
  getTokens: () => tokens,
  setTokens: (next) => sessionStore.setTokens(next),
  getContext: () => contextKey(activeContext),
  onSessionExpired: () => expiredHandler(),
});
