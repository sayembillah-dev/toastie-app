import type { SessionResponse } from '@toastly/access';

import { readRefreshToken, writeAccessToken, writeRefreshToken } from './token-storage';

/** What one refresh attempt established.
 *
 * - `refreshed`: storage now holds a fresh pair (from this call, or from
 *   another tab that rotated while this one waited).
 * - `rejected`: the server looked at the refresh token and refused it. This
 *   is the only outcome that should sign anyone out.
 * - `unavailable`: no verdict — offline, timeout, or a 5xx while the API
 *   restarts during a deploy. Keep the tokens; the next request can retry. */
export type RefreshOutcome =
  | { kind: 'refreshed'; session?: SessionResponse }
  | { kind: 'rejected' }
  | { kind: 'unavailable' };

const LOCK_NAME = 'openfloor-auth-refresh';

/** In-tab coalescing: the session bootstrap and every RTK query that 401s at
 * once share one call. */
let inflight: Promise<RefreshOutcome> | null = null;

/** Rotate the refresh token, once, across every caller in every tab.
 *
 * Refresh tokens rotate and a replay outside a short grace window revokes the
 * whole family, so two tabs spending the same token at once used to log the
 * person out everywhere. `navigator.locks` serialises the tabs; whoever gets
 * the lock second re-reads storage and, finding a token that already moved
 * on, uses it instead of spending the old one. */
export function refreshSession(): Promise<RefreshOutcome> {
  if (inflight) return inflight;
  const before = readRefreshToken();
  inflight = withCrossTabLock(() => rotate(before)).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return fn();
  return locks.request(LOCK_NAME, fn);
}

async function rotate(before: string | null): Promise<RefreshOutcome> {
  const current = readRefreshToken();
  if (!current) return { kind: 'rejected' };
  // Another tab rotated while this one waited for the lock.
  if (before && current !== before) return { kind: 'refreshed' };

  let res: Response;
  try {
    res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: current }),
    });
  } catch {
    return { kind: 'unavailable' };
  }

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return { kind: 'rejected' };
  }
  if (!res.ok) return { kind: 'unavailable' };

  try {
    const data = (await res.json()) as {
      tokens?: { accessToken?: string; refreshToken?: string };
      session?: SessionResponse;
    };
    const access = data.tokens?.accessToken;
    const next = data.tokens?.refreshToken;
    if (!access || !next) return { kind: 'unavailable' };
    writeAccessToken(access);
    writeRefreshToken(next);
    return { kind: 'refreshed', session: data.session };
  } catch {
    return { kind: 'unavailable' };
  }
}
