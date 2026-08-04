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
import type { ContactLog } from '@/lib/people/contact-logs';
import { SEED_CONTACT_LOGS } from '@/lib/people/contact-logs';
import type { Guest } from '@/lib/people/guests';
import { SEED_GUESTS } from '@/lib/people/guests';
import type { VisitLog } from '@/lib/people/visit-logs';
import { SEED_VISIT_LOGS } from '@/lib/people/visit-logs';

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
/* v2 added `stage` to the guest table — a v1 payload would leave every guest
 * out of the Kanban columns.
 * v3 replaced the fixed social fields with the `socials` array shape and added
 * avatarUrl / whatsapp / notes to Guest.
 * v4 introduced the contact-logs table backing the Contact logs drawer.
 * v5 introduced the visit-logs table backing the Visit logs drawer. */
const SCHEMA_VERSION = 'v5';

export const DB_KEYS = {
  members: `toastly.db.${SCHEMA_VERSION}.members`,
  historyEvents: `toastly.db.${SCHEMA_VERSION}.history-events`,
  memberExtras: `toastly.db.${SCHEMA_VERSION}.member-extras`,
  meetings: `toastly.db.${SCHEMA_VERSION}.meetings`,
  guests: `toastly.db.${SCHEMA_VERSION}.guests`,
  contactLogs: `toastly.db.${SCHEMA_VERSION}.contact-logs`,
  visitLogs: `toastly.db.${SCHEMA_VERSION}.visit-logs`,
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

function seedGuests(): Guest[] {
  return SEED_GUESTS;
}

function seedContactLogs(): ContactLog[] {
  return SEED_CONTACT_LOGS;
}

function seedVisitLogs(): VisitLog[] {
  return SEED_VISIT_LOGS;
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

export function readGuests(): Guest[] {
  return readTable(DB_KEYS.guests, seedGuests);
}

export function writeGuests(guests: Guest[]): void {
  writeTable(DB_KEYS.guests, guests);
}

export function readContactLogs(): ContactLog[] {
  return readTable(DB_KEYS.contactLogs, seedContactLogs);
}

export function writeContactLogs(logs: ContactLog[]): void {
  writeTable(DB_KEYS.contactLogs, logs);
}

export function readVisitLogs(): VisitLog[] {
  return readTable(DB_KEYS.visitLogs, seedVisitLogs);
}

export function writeVisitLogs(logs: VisitLog[]): void {
  writeTable(DB_KEYS.visitLogs, logs);
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
