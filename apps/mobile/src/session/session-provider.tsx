/**
 * The session: tokens, who the user is, and which club or unit they are acting
 * within. Everything authenticated hangs off this.
 *
 * Structured after Expo's Expo Router authentication guide (the SDK 53+
 * `Stack.Protected` flavour, not the older redirect one), extended with what
 * this API needs: a session fetch, a context selection, and an authorization
 * subject derived from both. The mutable half — the tokens and context the API
 * client reads mid-request — lives in `session-store`, not in refs here.
 */

import type { PermissionSubject } from '@toastly/access';
import type { PropsWithChildren } from 'react';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, TokenBundle } from '@/api';
import { ApiError, fetchSession, login as loginRequest, logout as logoutRequest } from '@/api';
import { getSecureItem, setSecureItem } from '@/lib/secure-storage';
import type { ActiveContext } from './context-value';
import { contextKey } from './context-value';
import {
  CONTEXT_STORAGE_KEY,
  persistTokens,
  readPersistedTokens,
  sessionStore,
} from './session-store';
import { availableContexts, defaultContext, sessionToSubject } from './subject';

export type SessionStatus = 'restoring' | 'signed-out' | 'signed-in';

type SessionContextValue = {
  status: SessionStatus;
  session: Session | null;
  /** Null while restoring, and for a signed-in user who belongs to nothing yet. */
  subject: PermissionSubject | null;
  activeContext: ActiveContext | null;
  contexts: ActiveContext[];
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchContext: (next: ActiveContext) => void;
  /** Re-read the session, e.g. after joining a club or a role change. */
  reload: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [session, setSession] = useState<Session | null>(null);
  const [activeContext, setActiveContextState] = useState<ActiveContext | null>(null);

  /** Keep React state and the store the API client reads in step. */
  const applyContext = useCallback((next: ActiveContext | null) => {
    sessionStore.setContext(next);
    setActiveContextState(next);
  }, []);

  const clearSession = useCallback(() => {
    sessionStore.setTokensInMemory(null);
    sessionStore.setContext(null);
    setSession(null);
    setActiveContextState(null);
    setStatus('signed-out');
  }, []);

  // The client calls this from inside a failed refresh, which is not a render.
  useEffect(() => {
    sessionStore.setExpiredHandler(clearSession);
  }, [clearSession]);

  /** Load the session for the tokens currently held, and pick a context. */
  const loadSession = useCallback(async () => {
    const next = await fetchSession();
    setSession(next);

    const storedKey = await getSecureItem(CONTEXT_STORAGE_KEY);
    const candidates = availableContexts(next);
    const restored = candidates.find((candidate) => contextKey(candidate) === storedKey);

    applyContext(restored ?? defaultContext(next));
    setStatus('signed-in');
  }, [applyContext]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await readPersistedTokens();
      if (cancelled) return;

      if (!stored) {
        setStatus('signed-out');
        return;
      }

      sessionStore.setTokensInMemory(stored);
      try {
        await loadSession();
      } catch (error) {
        if (cancelled) return;
        // An expired or revoked refresh token lands here. Anything else — the
        // API being unreachable, say — is not a reason to throw away a token
        // that may still be good, so only clear on an auth failure.
        if (error instanceof ApiError && error.isAuthFailure) {
          await persistTokens(null);
          clearSession();
        } else {
          setStatus('signed-out');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSession, clearSession]);

  const signIn = useCallback(
    async (phone: string, password: string) => {
      const result = await loginRequest(phone, password);
      const tokens: TokenBundle = {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      };
      await sessionStore.setTokens(tokens);
      await loadSession();
    },
    [loadSession],
  );

  const signOut = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Best effort. A failed logout call must not strand the user in a session
      // they asked to leave; the refresh token is discarded below regardless.
    }
    await persistTokens(null);
    await setSecureItem(CONTEXT_STORAGE_KEY, null);
    clearSession();
  }, [clearSession]);

  const switchContext = useCallback(
    (next: ActiveContext) => {
      applyContext(next);
      void setSecureItem(CONTEXT_STORAGE_KEY, contextKey(next));
    },
    [applyContext],
  );

  const reload = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      subject: session ? sessionToSubject(session) : null,
      activeContext,
      contexts: session ? availableContexts(session) : [],
      signIn,
      signOut,
      switchContext,
      reload,
    }),
    [status, session, activeContext, signIn, signOut, switchContext, reload],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
