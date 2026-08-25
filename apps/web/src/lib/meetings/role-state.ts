/**
 * Shared state for the three "live" role modules — Ah Counter, Timer, and
 * Grammarian — keyed by meeting. Both the in-app tab and the public share link
 * page read and write here so a guest holding the QR link stays in sync with
 * the club member watching in the tab, without either side owning the state.
 *
 * Persistence is two-tier: localStorage gives instant loads and same-tab
 * pub/sub, and a registered `RoleStateBackend` (wired up by
 * `role-state-sync.ts` — authed for the in-app tab, share-token for the
 * public page) mirrors every write to the server and hydrates from it on
 * mount. That server tier is what makes the data survive devices, browsers,
 * and the share-link handoff — before it existed, state lived in one
 * browser's localStorage only and revisiting the meeting from anywhere else
 * showed an empty tool.
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
  scheduleBackendSave(key, next);
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

/* ------------------------------------------------------------------ */
/* Server sync — registered per (kind, meeting) by `role-state-sync.ts`. */

/** Server persistence for one (kind, meeting) pair. Implementations live in
 * `role-state-sync.ts`: the authed variant hits
 * `/meetings/:id/role-state/:kind`, the public one the share-token twin. */
export interface RoleStateBackend {
  /** The stored blob, or null when nobody has saved state for this pair yet. */
  load(): Promise<unknown | null>;
  /** Fire-and-forget — a sync failure must never interrupt live capture. */
  save(state: unknown): void;
}

const backends = new Map<string, RoleStateBackend>();
/** Keys whose initial server load ran (or is in flight) — hydrate once per
 * session per (kind, meeting). */
const hydratedKeys = new Set<string>();
/** Debounced pending writes, so rapid Ah-Counter taps batch into one PUT. */
const pendingSaves = new Map<string, { handle: number; state: unknown }>();

const SAVE_DEBOUNCE_MS = 700;

/** Registers the server backend for a (kind, meeting) pair and kicks the
 * initial hydration. Returns the unregister for effect cleanup. */
export function registerRoleStateBackend(
  kind: RoleKind,
  meetingId: string,
  backend: RoleStateBackend,
): () => void {
  const key = stateKey(kind, meetingId);
  backends.set(key, backend);
  installFlushListeners();
  void hydrateRoleState(kind, meetingId);
  return () => {
    if (backends.get(key) === backend) backends.delete(key);
  };
}

/** First-load reconciliation. The server copy is the cross-device truth, so
 * it wins — unless a local write landed mid-load (the fresher capture wins
 * and is pushed up instead). A null server copy with a local copy present is
 * the pre-sync migration path: push the local data up so it reaches other
 * devices instead of dying with this browser. */
async function hydrateRoleState(kind: RoleKind, meetingId: string): Promise<void> {
  const key = stateKey(kind, meetingId);
  if (hydratedKeys.has(key)) return;
  const backend = backends.get(key);
  if (!backend) return;
  hydratedKeys.add(key);

  const localBefore = readRoleStateRaw(kind, meetingId);
  let remote: unknown | null;
  try {
    remote = await backend.load();
  } catch {
    hydratedKeys.delete(key); // offline / server down — retry on next mount
    return;
  }

  const localAfter = readRoleStateRaw(kind, meetingId);
  if (localAfter !== localBefore && localAfter) {
    safeSave(backend, localAfter);
    return;
  }
  if (remote === null || remote === undefined) {
    if (localAfter) safeSave(backend, localAfter);
    return;
  }
  const remoteRaw = JSON.stringify(remote);
  if (localAfter !== remoteRaw && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, remoteRaw);
      notifyListeners(key);
    } catch {
      /* Storage blocked — components still render the remote copy via the
       * notification above once the write lands, so nothing to do here. */
    }
  }
}

function safeSave(backend: RoleStateBackend, raw: string): void {
  try {
    backend.save(JSON.parse(raw));
  } catch {
    /* Unparseable local blob — leave the server copy alone. */
  }
}

function scheduleBackendSave(key: string, state: unknown): void {
  const backend = backends.get(key);
  if (!backend || typeof window === 'undefined') return;
  const pending = pendingSaves.get(key);
  if (pending) window.clearTimeout(pending.handle);
  pendingSaves.set(key, {
    state,
    handle: window.setTimeout(() => {
      pendingSaves.delete(key);
      backend.save(state);
    }, SAVE_DEBOUNCE_MS),
  });
}

/** Best-effort flush when the tab hides or closes — debounce alone would
 * drop the last seconds of a meeting if the host closes the lid mid-tap. */
function flushPendingSaves(): void {
  for (const [key, pending] of pendingSaves) {
    window.clearTimeout(pending.handle);
    backends.get(key)?.save(pending.state);
  }
  pendingSaves.clear();
}

let flushListenersInstalled = false;
function installFlushListeners(): void {
  if (flushListenersInstalled || typeof window === 'undefined') return;
  flushListenersInstalled = true;
  window.addEventListener('pagehide', flushPendingSaves);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSaves();
  });
}
