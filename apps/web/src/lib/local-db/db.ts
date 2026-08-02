import type { HistoryEvent, MemberProfileExtras } from '@/lib/education/history';
import {
  DEFAULT_EXTRAS,
  EXTRAS_SEED,
  HISTORY_SEED,
  synthesiseHistory,
} from '@/lib/education/history';
import type { Member } from '@/lib/education/members';
import { SEED_MEMBERS } from '@/lib/education/members';
import type { Meeting } from '@/lib/meetings/meetings';
import { SEED_MEETINGS } from '@/lib/meetings/meetings';

/**
 * The stand-in persistence layer. Until the Nest API exists, every write the UI
 * makes lands in localStorage under these keys, and the API layer in
 * `src/store/local-api` reads and writes exclusively through this module.
 *
 * Nothing outside `local-db` should touch localStorage — when the real backend
 * arrives this whole folder is deleted and the base query is swapped out, with
 * no component-level changes.
 */

/** Bump when the shape of a table changes so stale payloads reseed instead of
 * crashing a returning user's browser. */
const SCHEMA_VERSION = 'v1';

export const DB_KEYS = {
  members: `toastly.db.${SCHEMA_VERSION}.members`,
  historyEvents: `toastly.db.${SCHEMA_VERSION}.history-events`,
  memberExtras: `toastly.db.${SCHEMA_VERSION}.member-extras`,
  meetings: `toastly.db.${SCHEMA_VERSION}.meetings`,
} as const;

/** Used by the cross-tab sync listener to tell our writes apart from any other
 * localStorage traffic on the origin. */
export const DB_KEY_LIST: readonly string[] = Object.values(DB_KEYS);

type MemberExtrasTable = Record<string, MemberProfileExtras>;

/* ---------------------------------------------------------------- seeding -- */

function seedMembers(): Member[] {
  return SEED_MEMBERS;
}

/** Flattens the per-member seed map into one event table keyed the way a real
 * `history_events` table would be. Members without a hand-written story get the
 * synthesised join event so every member has a timeline from day one. */
function seedHistoryEvents(): HistoryEvent[] {
  return SEED_MEMBERS.flatMap((member) => HISTORY_SEED[member.id] ?? synthesiseHistory(member));
}

function seedMeetings(): Meeting[] {
  return SEED_MEETINGS;
}

function seedMemberExtras(): MemberExtrasTable {
  const table: MemberExtrasTable = {};
  for (const member of SEED_MEMBERS) {
    table[member.id] = EXTRAS_SEED[member.id] ?? DEFAULT_EXTRAS;
  }
  return table;
}

/* ------------------------------------------------------------ table access -- */

function readTable<T>(key: string, buildSeed: () => T): T {
  if (typeof window === 'undefined') return buildSeed();

  const raw = window.localStorage.getItem(key);
  if (raw !== null) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt payload — fall through and reseed rather than leaving the app
      // permanently broken for whoever hand-edited devtools.
    }
  }

  const seeded = buildSeed();
  writeTable(key, seeded);
  return seeded;
}

function writeTable<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readMembers(): Member[] {
  return readTable(DB_KEYS.members, seedMembers);
}

export function writeMembers(members: Member[]): void {
  writeTable(DB_KEYS.members, members);
}

export function readHistoryEvents(): HistoryEvent[] {
  return readTable(DB_KEYS.historyEvents, seedHistoryEvents);
}

export function writeHistoryEvents(events: HistoryEvent[]): void {
  writeTable(DB_KEYS.historyEvents, events);
}

export function readMeetings(): Meeting[] {
  return readTable(DB_KEYS.meetings, seedMeetings);
}

export function writeMeetings(meetings: Meeting[]): void {
  writeTable(DB_KEYS.meetings, meetings);
}

export function readMemberExtras(): MemberExtrasTable {
  return readTable(DB_KEYS.memberExtras, seedMemberExtras);
}

export function readExtrasFor(memberId: string): MemberProfileExtras {
  return readMemberExtras()[memberId] ?? DEFAULT_EXTRAS;
}

/** Drops every table so the next read reseeds. Handy while the backend does not
 * exist yet — call it from the devtools console to get back to a clean roster. */
export function resetLocalDb(): void {
  if (typeof window === 'undefined') return;
  for (const key of DB_KEY_LIST) window.localStorage.removeItem(key);
}
