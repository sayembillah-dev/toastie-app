'use client';

import type { ActiveContextKey, SessionResponse } from '@toastly/access';
import { useCallback, useEffect } from 'react';

import {
  clearAuthStorage,
  readAccessToken,
  readRefreshToken,
  readStoredContext,
  writeAccessToken,
  writeRefreshToken,
  writeStoredContext,
} from '@/lib/auth/token-storage';
import { useAppDispatch } from '@/store/hooks';
import { isContextKeyValid, sessionLoaded, sessionUnauthenticated } from '@/store/session-slice';

/** Fetch `/auth/session`, and on 401 try the refresh dance once before
 * giving up. This is deliberately a plain `fetch` rather than an RTK
 * Query call — we run it before the store is ready to render anything
 * gated on the session, and we don't want to add a cache entry for a
 * one-shot bootstrap request. */
async function fetchLiveSession(): Promise<SessionResponse | null> {
  const access = readAccessToken();
  if (!access) return null;

  const attempt = async (token: string): Promise<Response> =>
    fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });

  const res = await attempt(access);
  if (res.status === 401) {
    const refresh = readRefreshToken();
    if (!refresh) return null;
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!refreshRes.ok) return null;
    const data = (await refreshRes.json()) as {
      tokens: { accessToken: string; refreshToken: string };
      session: SessionResponse;
    };
    writeAccessToken(data.tokens.accessToken);
    writeRefreshToken(data.tokens.refreshToken);
    // The refresh endpoint already returns the session — no need for a
    // second round-trip.
    return data.session;
  }
  if (!res.ok) return null;
  return (await res.json()) as SessionResponse;
}

/** Applies a freshly-fetched session payload the same way on every call
 * site: validate any stored context against it, persist the resolved
 * context, and dispatch `sessionLoaded`. */
function applySessionPayload(
  dispatch: ReturnType<typeof useAppDispatch>,
  payload: SessionResponse,
): void {
  const stored = readStoredContext();
  const valid = stored && isContextKeyValid(stored, payload) ? stored : null;
  const contextKey = (valid ?? payload.defaultContextKey) as ActiveContextKey | null;
  if (contextKey && contextKey !== stored) writeStoredContext(contextKey);
  dispatch(sessionLoaded({ payload, contextKey }));
}

/** Re-fetches `/auth/session` and re-dispatches it — the same hydration
 * `SessionProvider` runs on mount. Exposed so a client action that changes
 * membership state in-place (e.g. joining a club by code from the
 * onboarding screen) can pull the fresh session without a route change:
 * `SessionProvider` is mounted once by `(app)/layout.tsx` and won't re-run
 * its own mount effect on a same-layout navigation. */
export function useSessionRefresh(): () => Promise<void> {
  const dispatch = useAppDispatch();

  return useCallback(async () => {
    const payload = await fetchLiveSession();
    if (!payload) {
      clearAuthStorage();
      dispatch(sessionUnauthenticated());
      return;
    }
    applySessionPayload(dispatch, payload);
  }, [dispatch]);
}

/** Loads the session on mount, validates any stored context against the
 * returned memberships/assignments, and dispatches `sessionLoaded`.
 *
 * Runs inside `useEffect` so the first render is deterministic — same
 * output on server and client — and `localStorage` reads happen
 * post-hydration. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const payload = await fetchLiveSession();
      if (cancelled) return;
      if (!payload) {
        clearAuthStorage();
        dispatch(sessionUnauthenticated());
        return;
      }
      applySessionPayload(dispatch, payload);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return <>{children}</>;
}
