'use client';

import type { ActiveContextKey, SessionResponse } from '@toastly/access';
import { useCallback, useEffect } from 'react';

import { refreshSession } from '@/lib/auth/refresh';
import {
  clearAuthStorage,
  readAccessToken,
  readStoredContext,
  writeStoredContext,
} from '@/lib/auth/token-storage';
import { useAppDispatch } from '@/store/hooks';
import { isContextKeyValid, sessionLoaded, sessionUnauthenticated } from '@/store/session-slice';

/** Result of loading the session at startup: the payload, a definite
 * sign-out, or no verdict because the server could not be reached. */
type LiveSession = SessionResponse | 'signed-out' | 'unavailable';

/** Fetch `/auth/session`, and on 401 try the refresh dance once before
 * giving up. This is deliberately a plain `fetch` rather than an RTK
 * Query call — we run it before the store is ready to render anything
 * gated on the session, and we don't want to add a cache entry for a
 * one-shot bootstrap request. The refresh itself goes through the same
 * `refreshSession()` as RTK Query, so the two can never spend one refresh
 * token twice. */
async function fetchLiveSession(): Promise<LiveSession> {
  const access = readAccessToken();
  if (!access) return 'signed-out';

  const attempt = async (token: string): Promise<Response | null> => {
    try {
      return await fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      return null;
    }
  };

  let res = await attempt(access);
  if (!res) return 'unavailable';
  if (res.status === 401) {
    const outcome = await refreshSession();
    if (outcome.kind === 'rejected') return 'signed-out';
    if (outcome.kind === 'unavailable') return 'unavailable';
    // The refresh endpoint returns the session; when another tab did the
    // rotating, fetch it with the token that tab stored.
    if (outcome.session) return outcome.session;
    const fresh = readAccessToken();
    if (!fresh) return 'signed-out';
    res = await attempt(fresh);
    if (!res) return 'unavailable';
    if (res.status === 401) return 'signed-out';
  }
  if (!res.ok) return 'unavailable';
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
    const result = await fetchLiveSession();
    // Unreachable: keep showing the session already loaded.
    if (result === 'unavailable') return;
    if (result === 'signed-out') {
      clearAuthStorage();
      dispatch(sessionUnauthenticated());
      return;
    }
    applySessionPayload(dispatch, result);
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
      // A server that is briefly unreachable (a deploy, a dropped signal)
      // gets a few more tries before the screen gives up — and even then the
      // tokens stay, so the next reload picks the session straight back up.
      let result = await fetchLiveSession();
      for (const wait of [1000, 3000, 6000]) {
        if (result !== 'unavailable' || cancelled) break;
        await new Promise((resolve) => setTimeout(resolve, wait));
        result = await fetchLiveSession();
      }
      if (cancelled) return;
      if (result === 'signed-out') {
        clearAuthStorage();
        dispatch(sessionUnauthenticated());
        return;
      }
      if (result === 'unavailable') {
        dispatch(sessionUnauthenticated());
        return;
      }
      applySessionPayload(dispatch, result);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return <>{children}</>;
}
