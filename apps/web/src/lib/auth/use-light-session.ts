'use client';

import type { SessionResponse } from '@toastly/access';
import { useSyncExternalStore } from 'react';

import { readAccessToken } from '@/lib/auth/token-storage';
import { useGetAuthSessionQuery } from '@/store/api';

export type LightSessionStatus = 'checking' | 'authenticated' | 'unauthenticated';

export interface LightSession {
  status: LightSessionStatus;
  session: SessionResponse | null;
}

const noopSubscribe = () => () => {};

/** Whether an access token is in localStorage, read the SSR-safe way:
 * `useSyncExternalStore`'s server snapshot is `null` (server has no
 * `window`), and the client snapshot is only read after hydration, so the
 * two never disagree on the same render the way a raw `useEffect` + local
 * `setState` would. */
function useHasAccessToken(): boolean | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => !!readAccessToken(),
    () => null,
  );
}

/** Minimal, local auth check for pages in the `(public)` route group, where
 * `SessionProvider` never mounts and the Redux session slice stays at its
 * `idle` initial state forever (see `app/(public)/layout.tsx`). If a token
 * is present, verifies it against `GET /auth/session` — the same endpoint
 * `SessionProvider` uses, just without writing into the shared store, since
 * these pages render their own UI directly off the result. */
export function useLightSession(): LightSession {
  const hasToken = useHasAccessToken();

  const { data, isLoading, isError } = useGetAuthSessionQuery(undefined, {
    skip: hasToken !== true,
  });

  if (hasToken === null) return { status: 'checking', session: null };
  if (!hasToken) return { status: 'unauthenticated', session: null };
  if (isLoading) return { status: 'checking', session: null };
  if (isError || !data) return { status: 'unauthenticated', session: null };
  return { status: 'authenticated', session: data };
}
