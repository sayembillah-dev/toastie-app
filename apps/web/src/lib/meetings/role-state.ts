/**
 * Shared state for the three "live" role modules — Ah Counter, Timer, and
 * Grammarian — keyed by meeting. Both the in-app tab and the public share link
 * page read and write here so a guest holding the QR link stays in sync with
 * the club member watching in the tab, without either side owning the state.
 *
 * Persistence is two-tier: localStorage gives instant loads and same-tab
 * pub/sub, and a registered `RoleStateBackend` (wired up by
 * `role-state-sync.ts` — authed for the in-app tab, share-token for the
 * public page) mirrors every write to the server, hydrates from it on
 * mount, and polls it on a short interval so writes from other devices
 * land here without a reload. That server tier is what makes the data
 * survive devices, browsers, and the share-link handoff — before it
 * existed, state lived in one browser's
 * localStorage only and revisiting the meeting from anywhere else showed an
 * empty tool.
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

/** One tracked speaker in the word-of-the-day counter. */
export interface GrammarianWotdSpeaker {
  id: string;
  memberId?: string;
  guestId?: string;
  name: string;
  count: number;
}

export interface GrammarianState {
  entries: GrammarianEntry[];
  /** Per-speaker tally of word-of-the-day usage. The word itself is NOT here —
   * it belongs to the meeting record (set on the Theme tab) and is read from
   * there, so it can never drift between tabs. */
  wotdSpeakers: GrammarianWotdSpeaker[];
}

export function emptyGrammarianState(): GrammarianState {
  return { entries: [], wotdSpeakers: [] };
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
  /** Never throws — resolves false on any failure so the registry can keep
   * the key dirty (retry the push; never let a stale pull clobber unsynced
   * local writes). Live capture must never break because a sync failed. */
  save(state: unknown): Promise<boolean>;
}

const backends = new Map<string, RoleStateBackend>();
/** Keys whose initial server load ran (or is in flight) — hydrate once per
 * session per (kind, meeting). */
const hydratedKeys = new Set<string>();
/** Debounced pending writes, so rapid Ah-Counter taps batch into one PUT. */
const pendingSaves = new Map<string, { handle: number; state: unknown }>();
/** Keys with local writes the server hasn't confirmed. A failed save keeps
 * the key dirty: polling then retries the push instead of pulling the
 * server's stale copy over the fresher local one. */
const dirtyKeys = new Set<string>();
/** Saves currently in flight — polls stand down so the two never race. */
const savingKeys = new Set<string>();
/** Pulls currently in flight — overlapping poll ticks skip. */
const pullsInFlight = new Set<string>();
const pollTimers = new Map<string, number>();

const SAVE_DEBOUNCE_MS = 700;
/** Cross-device freshness cadence. Running timers render from `startedAt`
 * (a wall-clock timestamp), so a poll only needs to deliver the discrete
 * events — start/stop taps, Ah-Counter marks — and 5 s is plenty for that. */
const POLL_INTERVAL_MS = 5000;

/** Registers the server backend for a (kind, meeting) pair, kicks the
 * initial hydration, and starts the cross-device poll. Returns the
 * unregister for effect cleanup. */
export function registerRoleStateBackend(
  kind: RoleKind,
  meetingId: string,
  backend: RoleStateBackend,
): () => void {
  const key = stateKey(kind, meetingId);
  backends.set(key, backend);
  installFlushListeners();
  void hydrateRoleState(kind, meetingId);
  startPolling(kind, meetingId);
  return () => {
    if (backends.get(key) === backend) {
      backends.delete(key);
      stopPolling(key);
    }
  };
}

/** First-load reconciliation — once per session per (kind, meeting). The
 * merge itself lives in `pullAndReconcile`, shared with the poll ticks. */
async function hydrateRoleState(kind: RoleKind, meetingId: string): Promise<void> {
  const key = stateKey(kind, meetingId);
  if (hydratedKeys.has(key)) return;
  hydratedKeys.add(key);
  const loaded = await pullAndReconcile(kind, meetingId);
  if (!loaded) hydratedKeys.delete(key); // offline / server down — retry on next mount
}

/** Pulls the server copy and reconciles it with local. The server copy is
 * the cross-device truth, so it wins — unless:
 * - a local write landed mid-load (the fresher capture is pushed up instead;
 *   this also covers writes that arrived via a cross-tab `storage` event,
 *   which never scheduled a backend save in this tab),
 * - the key is dirty or mid-save (the server copy is stale by definition —
 *   the push side owns the key until its save confirms), or
 * - the server has nothing yet but local does (pre-sync migration: push the
 *   local data up so it reaches other devices instead of dying here).
 * Resolves false only when the load itself failed. */
async function pullAndReconcile(kind: RoleKind, meetingId: string): Promise<boolean> {
  const key = stateKey(kind, meetingId);
  const backend = backends.get(key);
  if (!backend || pullsInFlight.has(key)) return true;
  pullsInFlight.add(key);
  try {
    const localBefore = readRoleStateRaw(kind, meetingId);
    let remote: unknown | null;
    try {
      remote = await backend.load();
    } catch {
      return false;
    }

    const localAfter = readRoleStateRaw(kind, meetingId);
    if (localAfter !== localBefore && localAfter) {
      safeSave(key, backend, localAfter);
      return true;
    }
    if (remote === null || remote === undefined) {
      if (localAfter) safeSave(key, backend, localAfter);
      return true;
    }
    if (dirtyKeys.has(key) || savingKeys.has(key)) return true;
    // JSONB doesn't preserve key order, so compare semantically — a textual
    // compare would see phantom changes on every poll and re-render the
    // view every few seconds for nothing.
    if (statesEqual(localAfter, remote)) return true;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(remote));
        notifyListeners(key);
      } catch {
        /* Storage blocked — a later poll retries the apply. */
      }
    }
    return true;
  } finally {
    pullsInFlight.delete(key);
  }
}

/** Pushes a raw local blob up, tracking dirtiness via `persistNow`. */
function safeSave(key: string, backend: RoleStateBackend, raw: string): void {
  try {
    void persistNow(key, backend, JSON.parse(raw));
  } catch {
    /* Unparseable local blob — leave the server copy alone. */
  }
}

async function persistNow(key: string, backend: RoleStateBackend, state: unknown): Promise<void> {
  savingKeys.add(key);
  let ok: boolean;
  try {
    ok = await backend.save(state);
  } catch {
    ok = false;
  }
  savingKeys.delete(key);
  if (ok) {
    // A newer write queued while this one flew — stay dirty until it lands.
    if (!pendingSaves.has(key)) dirtyKeys.delete(key);
  } else {
    dirtyKeys.add(key);
  }
}

/** Key-order-insensitive comparison — Postgres JSONB normalizes key order,
 * so a naive string compare would see phantom differences on every poll. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? '';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const body = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${body.join(',')}}`;
}

function statesEqual(localRaw: string | null, remote: unknown): boolean {
  if (!localRaw) return false;
  try {
    return stableStringify(JSON.parse(localRaw)) === stableStringify(remote);
  } catch {
    return localRaw === JSON.stringify(remote);
  }
}

function scheduleBackendSave(key: string, state: unknown): void {
  const backend = backends.get(key);
  if (!backend || typeof window === 'undefined') return;
  dirtyKeys.add(key);
  const pending = pendingSaves.get(key);
  if (pending) window.clearTimeout(pending.handle);
  pendingSaves.set(key, {
    state,
    handle: window.setTimeout(() => {
      pendingSaves.delete(key);
      void persistNow(key, backend, state);
    }, SAVE_DEBOUNCE_MS),
  });
}

/** Best-effort flush when the tab hides or closes — debounce alone would
 * drop the last seconds of a meeting if the host closes the lid mid-tap. */
function flushPendingSaves(): void {
  for (const [key, pending] of pendingSaves) {
    window.clearTimeout(pending.handle);
    const backend = backends.get(key);
    if (backend) void persistNow(key, backend, pending.state);
  }
  pendingSaves.clear();
}

function startPolling(kind: RoleKind, meetingId: string): void {
  const key = stateKey(kind, meetingId);
  stopPolling(key);
  if (typeof window === 'undefined') return;
  pollTimers.set(
    key,
    window.setInterval(() => {
      // Hydration pending — stand down. Hydration failed — retry it here
      // instead of waiting for a remount. A queued debounce or an in-flight
      // save means local is ahead, so stand down. A dirty key means the
      // last push failed: retry the push rather than pulling the server's
      // stale copy over fresher local data.
      if (!hydratedKeys.has(key)) {
        void hydrateRoleState(kind, meetingId);
        return;
      }
      if (pendingSaves.has(key) || savingKeys.has(key)) return;
      if (dirtyKeys.has(key)) {
        retryDirtySave(key);
        return;
      }
      void pullAndReconcile(kind, meetingId);
    }, POLL_INTERVAL_MS),
  );
}

function stopPolling(key: string): void {
  const handle = pollTimers.get(key);
  if (handle === undefined || typeof window === 'undefined') return;
  window.clearInterval(handle);
  pollTimers.delete(key);
}

function retryDirtySave(key: string): void {
  const backend = backends.get(key);
  if (!backend || typeof window === 'undefined') return;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (!raw) {
    dirtyKeys.delete(key);
    return;
  }
  safeSave(key, backend, raw);
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
