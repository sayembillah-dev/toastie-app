/**
 * Identity of the person operating a shared role page. Same shape as the
 * evaluator identity gate — `isAssignedHolder` flips true when the visitor
 * confirmed they are the role member from the meeting's assignments; false
 * when they typed their own name because they're standing in.
 */

import type { RoleKind } from './role-state';

const KEY_PREFIX = 'toastly:role-identity';

export interface RoleHolderIdentity {
  name: string;
  isAssignedHolder: boolean;
  confirmedAt: string;
}

function identityKey(kind: RoleKind, meetingId: string): string {
  return `${KEY_PREFIX}:${kind}:${meetingId}`;
}

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function notifyListeners(key: string): void {
  const set = listeners.get(key);
  if (!set) return;
  for (const listener of set) listener();
}

export function subscribeToRoleIdentity(
  kind: RoleKind,
  meetingId: string,
  listener: Listener,
): () => void {
  const key = identityKey(kind, meetingId);
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);

  const storageHandler = (event: StorageEvent) => {
    if (event.key === key) listener();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }

  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(key);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
  };
}

export function readRoleIdentityRaw(kind: RoleKind, meetingId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(identityKey(kind, meetingId));
  } catch {
    return null;
  }
}

export function parseRoleIdentity(raw: string | null): RoleHolderIdentity | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RoleHolderIdentity;
    if (!parsed || typeof parsed.name !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeRoleIdentity(
  kind: RoleKind,
  meetingId: string,
  identity: Omit<RoleHolderIdentity, 'confirmedAt'>,
): RoleHolderIdentity {
  const stamped: RoleHolderIdentity = {
    ...identity,
    confirmedAt: new Date().toISOString(),
  };
  const key = identityKey(kind, meetingId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(stamped));
    } catch {
      /* Ignore — caller keeps in-memory state via the returned value. */
    }
  }
  notifyListeners(key);
  return stamped;
}

export function clearRoleIdentity(kind: RoleKind, meetingId: string): void {
  const key = identityKey(kind, meetingId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  notifyListeners(key);
}
