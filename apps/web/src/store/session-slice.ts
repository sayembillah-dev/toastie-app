import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type {
  ActiveContextKey,
  SessionMembership,
  SessionOrgAssignment,
  SessionResponse,
  SessionUser,
} from '@toastly/access';

/** Session state — populated on mount from `GET /auth/session` (post-S8) or
 * from the local-db mock (pre-S8). Initial state is identical on server and
 * first client render — `SessionProvider` reads `localStorage` inside its
 * `useEffect`, post-hydration, so React never sees a mismatch here. */
export interface SessionState {
  status: 'idle' | 'ready' | 'unauthenticated';
  user: SessionUser | null;
  memberships: SessionMembership[];
  orgAssignments: SessionOrgAssignment[];
  defaultContextKey: ActiveContextKey | null;
  contextKey: ActiveContextKey | null;
}

const initialState: SessionState = {
  status: 'idle',
  user: null,
  memberships: [],
  orgAssignments: [],
  defaultContextKey: null,
  contextKey: null,
};

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionLoaded(
      state,
      action: PayloadAction<{ payload: SessionResponse; contextKey: ActiveContextKey | null }>,
    ) {
      const { payload, contextKey } = action.payload;
      state.status = 'ready';
      state.user = payload.user;
      state.memberships = payload.memberships;
      state.orgAssignments = payload.orgAssignments;
      state.defaultContextKey = payload.defaultContextKey;
      state.contextKey = contextKey;
    },
    sessionUnauthenticated(state) {
      state.status = 'unauthenticated';
      state.user = null;
      state.memberships = [];
      state.orgAssignments = [];
      state.defaultContextKey = null;
      state.contextKey = null;
    },
    contextChanged(state, action: PayloadAction<ActiveContextKey>) {
      state.contextKey = action.payload;
    },
    /** Clears the post-login "set your own password" nudge the moment the
     * self-service change succeeds — the mutation itself doesn't return a
     * fresh session, so the caller patches this one field locally instead
     * of a full reload. */
    passwordChanged(state) {
      if (state.user) state.user.mustChangePassword = false;
    },
    /** Patches the identity fields the profile page can edit straight onto
     * the session, mirroring `passwordChanged` — the mutation already
     * returns the fresh values, so a full session reload would be waste. */
    profileUpdated(
      state,
      action: PayloadAction<
        Pick<SessionUser, 'firstName' | 'lastName' | 'email' | 'phone' | 'avatarUrl'>
      >,
    ) {
      if (!state.user) return;
      Object.assign(state.user, action.payload);
    },
    sessionCleared() {
      return initialState;
    },
  },
  selectors: {
    selectSessionStatus: (state) => state.status,
    selectSessionUser: (state) => state.user,
    selectSessionMemberships: (state) => state.memberships,
    selectSessionOrgAssignments: (state) => state.orgAssignments,
    selectActiveContextKey: (state) => state.contextKey,
  },
});

export const {
  sessionLoaded,
  sessionUnauthenticated,
  contextChanged,
  passwordChanged,
  profileUpdated,
  sessionCleared,
} = sessionSlice.actions;
export const {
  selectSessionStatus,
  selectSessionUser,
  selectSessionMemberships,
  selectSessionOrgAssignments,
  selectActiveContextKey,
} = sessionSlice.selectors;

/** Parsed shape of an `ActiveContextKey`. Returns `null` for anything
 * malformed so a hand-edited localStorage value can't crash the shell —
 * the caller falls back to the default context. */
export type ActiveContext =
  | { kind: 'club'; clubId: string }
  | { kind: 'area'; unitId: string }
  | { kind: 'division'; unitId: string }
  | { kind: 'district'; unitId: string }
  | { kind: 'global' };

export function parseContextKey(key: ActiveContextKey | string | null): ActiveContext | null {
  if (!key) return null;
  if (key === 'global') return { kind: 'global' };
  const idx = key.indexOf(':');
  if (idx < 0) return null;
  const kind = key.slice(0, idx);
  const id = key.slice(idx + 1);
  if (!id) return null;
  if (kind === 'club') return { kind: 'club', clubId: id };
  if (kind === 'area') return { kind: 'area', unitId: id };
  if (kind === 'division') return { kind: 'division', unitId: id };
  if (kind === 'district') return { kind: 'district', unitId: id };
  return null;
}

/** Where a fresh switch to `context` should land. Used by `UnitSwitcher` and
 * `SessionProvider` when a stored context is invalid. */
export function defaultRouteForContext(key: ActiveContextKey | string | null): string {
  const parsed = parseContextKey(key);
  if (!parsed) return '/';
  if (parsed.kind === 'club') return '/';
  if (parsed.kind === 'global') return '/super-admin';
  return `/${parsed.kind}`;
}

/** True when the stored key is still held by the returned session. Rejects a
 * `club:c-01` context if the user has been removed from that club. */
export function isContextKeyValid(
  key: ActiveContextKey | string,
  payload: Pick<SessionResponse, 'memberships' | 'orgAssignments' | 'user'>,
): boolean {
  const parsed = parseContextKey(key);
  if (!parsed) return false;
  if (parsed.kind === 'global') return payload.user?.isSuperAdmin ?? false;
  if (parsed.kind === 'club') return payload.memberships.some((m) => m.clubId === parsed.clubId);
  return payload.orgAssignments.some(
    (a) => a.unitType === parsed.kind && a.unitId === parsed.unitId,
  );
}
