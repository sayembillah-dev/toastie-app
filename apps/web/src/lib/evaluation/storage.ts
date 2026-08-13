/**
 * "Remember me on this device" for the public evaluation form. The evaluator
 * confirms who they are once per (meeting, speaker) and that identity is
 * kept in localStorage so returning to the same link — or refreshing —
 * doesn't ask again. This is a legitimate client-only feature, unlike the
 * evaluation *submission* itself: that goes to the real API (see
 * `lib/evaluation/upload.ts` and `useSubmitPublicEvaluationMutation`).
 */

const KEY_PREFIX = 'toastly:evaluation';

export interface EvaluatorIdentity {
  name: string;
  /** True when the visitor confirmed they are the assigned evaluator. */
  isAssignedEvaluator: boolean;
  /** ISO string — recorded once the gate is answered so we don't ask again. */
  confirmedAt: string;
}

function identityKey(meetingId: string, speakerId: string): string {
  return `${KEY_PREFIX}:identity:${meetingId}:${speakerId}`;
}

/* In-tab pub/sub for identity writes. localStorage's `storage` event only
 * fires across tabs, but `useSyncExternalStore` needs a same-tab signal so a
 * write triggers a re-render on the same page that wrote it. */
type IdentityListener = () => void;
const identityListeners = new Map<string, Set<IdentityListener>>();

function notifyIdentityListeners(key: string): void {
  const set = identityListeners.get(key);
  if (!set) return;
  for (const listener of set) listener();
}

export function subscribeToIdentity(
  meetingId: string,
  speakerId: string,
  listener: IdentityListener,
): () => void {
  const key = identityKey(meetingId, speakerId);
  let set = identityListeners.get(key);
  if (!set) {
    set = new Set();
    identityListeners.set(key, set);
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
    if (set!.size === 0) identityListeners.delete(key);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
  };
}

/** Raw JSON snapshot for `useSyncExternalStore` — the string reference is
 * stable between renders when the underlying value hasn't changed. */
export function readIdentityRaw(meetingId: string, speakerId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(identityKey(meetingId, speakerId));
  } catch {
    return null;
  }
}

export function parseIdentity(raw: string | null): EvaluatorIdentity | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EvaluatorIdentity;
    if (!parsed || typeof parsed.name !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeIdentity(
  meetingId: string,
  speakerId: string,
  identity: Omit<EvaluatorIdentity, 'confirmedAt'>,
): EvaluatorIdentity {
  const stamped: EvaluatorIdentity = {
    ...identity,
    confirmedAt: new Date().toISOString(),
  };
  const key = identityKey(meetingId, speakerId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(stamped));
    } catch {
      /* Storage full or blocked — the caller still keeps in-memory state. */
    }
  }
  notifyIdentityListeners(key);
  return stamped;
}

export function clearIdentity(meetingId: string, speakerId: string): void {
  const key = identityKey(meetingId, speakerId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  notifyIdentityListeners(key);
}
