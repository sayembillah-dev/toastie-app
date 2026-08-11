/**
 * Shared state for the three "live" role modules — Ah Counter, Timer, and
 * Grammarian — keyed by meeting. Both the in-app tab and the public share link
 * page read and write here so a guest holding the QR link stays in sync with
 * the club member watching in the tab, without either side owning the state.
 *
 * localStorage placeholder mirrors the evaluation flow (see
 * `lib/evaluation/storage.ts`) — swap for a POST/subscribe backend once one
 * lands and callers won't need to change. Cross-device sync isn't implied by
 * localStorage; that arrives with the real backend.
 */

const KEY_PREFIX = 'toastly:role';

export type RoleKind = 'ah-counter' | 'timer' | 'grammarian';

export interface AhSpeakerCount {
  id: string;
  memberId?: string;
  guestId?: string;
  name: string;
  counts: Record<string, number>;
  expanded: boolean;
  /** Set when this row was populated by "Take from agenda" — the agenda
   * source's stable key (see `agenda-speaker-sources.ts`), so a later click
   * updates this same row instead of adding a duplicate. Absent for
   * manually added speakers, which "Take from agenda" never touches. */
  agendaKey?: string;
}

export interface AhCounterState {
  categories: string[];
  speakers: AhSpeakerCount[];
}

export const AH_DEFAULT_CATEGORIES = ['AH', 'UM', 'ERR', 'THE'];

export function emptyAhCounterState(): AhCounterState {
  return { categories: [...AH_DEFAULT_CATEGORIES], speakers: [] };
}

export const TIMER_SPEAKER_TYPES = [
  'Prepared Speaker',
  'Ice Breaker',
  'Table Topic',
  'Speech Evaluator',
  'TT Evaluator',
  'General Evaluator',
] as const;
export type TimerSpeakerType = (typeof TIMER_SPEAKER_TYPES)[number];

export type TimerStatus = 'idle' | 'running' | 'done';

/** Green/yellow/red thresholds, in seconds. */
export interface Bracket {
  green: number;
  yellow: number;
  red: number;
}

export interface TimerSpeaker {
  id: string;
  memberId?: string;
  guestId?: string;
  name: string;
  type: TimerSpeakerType;
  status: TimerStatus;
  /** Committed elapsed seconds — what we render for stopped speakers and the
   * base value when a running timer resumes. */
  elapsed: number;
  /** Wall-clock ms at the last Start. Undefined unless status === 'running'. */
  startedAt?: number;
  /** Overrides the type's default bracket — set by "Take from agenda" for a
   * prepared speaker so the lights follow that speech's own project timing
   * instead of the generic 5–6–7 default. */
  brackets?: Bracket;
  /** Set when this row was populated by "Take from agenda" — see
   * `AhSpeakerCount.agendaKey`. */
  agendaKey?: string;
}

export interface TimerState {
  speakers: TimerSpeaker[];
  activeId: string | null;
}

export function emptyTimerState(): TimerState {
  return { speakers: [], activeId: null };
}

export interface GrammarianEntry {
  id: string;
  said: string;
  corrected: string;
  createdAt: number;
}

export interface GrammarianState {
  entries: GrammarianEntry[];
}

export function emptyGrammarianState(): GrammarianState {
  return { entries: [] };
}

export interface RoleStateByKind {
  'ah-counter': AhCounterState;
  timer: TimerState;
  grammarian: GrammarianState;
}

const EMPTY_FACTORIES: { [K in RoleKind]: () => RoleStateByKind[K] } = {
  'ah-counter': emptyAhCounterState,
  timer: emptyTimerState,
  grammarian: emptyGrammarianState,
};

function stateKey(kind: RoleKind, meetingId: string): string {
  return `${KEY_PREFIX}:${kind}:${meetingId}`;
}

/* In-tab pub/sub — localStorage's `storage` event only fires across tabs, but
 * `useSyncExternalStore` needs to hear about same-tab writes too, so we notify
 * listeners manually on every setter. */
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function notifyListeners(key: string): void {
  const set = listeners.get(key);
  if (!set) return;
  for (const listener of set) listener();
}

export function subscribeToRoleState(
  kind: RoleKind,
  meetingId: string,
  listener: Listener,
): () => void {
  const key = stateKey(kind, meetingId);
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

/** Raw JSON snapshot for `useSyncExternalStore` — string reference is stable
 * between renders when the underlying value hasn't changed. */
export function readRoleStateRaw(kind: RoleKind, meetingId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(stateKey(kind, meetingId));
  } catch {
    return null;
  }
}

export function parseRoleState<K extends RoleKind>(
  kind: K,
  raw: string | null,
): RoleStateByKind[K] {
  const fallback = EMPTY_FACTORIES[kind]() as RoleStateByKind[K];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<RoleStateByKind[K]>;
    if (!parsed || typeof parsed !== 'object') return fallback;
    return { ...fallback, ...parsed } as RoleStateByKind[K];
  } catch {
    return fallback;
  }
}

export function writeRoleState<K extends RoleKind>(
  kind: K,
  meetingId: string,
  next: RoleStateByKind[K],
): void {
  const key = stateKey(kind, meetingId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Storage full or blocked — callers still get in-memory state via
       * the updater's returned value. */
    }
  }
  notifyListeners(key);
}

/** Read + write shortcut for reducer-style updates. Passing the current value
 * to the updater lets a caller avoid the read/write dance at every call site. */
export function updateRoleState<K extends RoleKind>(
  kind: K,
  meetingId: string,
  updater: (previous: RoleStateByKind[K]) => RoleStateByKind[K],
): RoleStateByKind[K] {
  const current = parseRoleState(kind, readRoleStateRaw(kind, meetingId));
  const next = updater(current);
  writeRoleState(kind, meetingId, next);
  return next;
}
