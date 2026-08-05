import type { ActivityLog } from '@/lib/activity/activity-log';
import { SEED_ACTIVITY_LOGS } from '@/lib/activity/activity-log';
import type { Evaluation } from '@/lib/education/evaluations';
import { EVALUATION_SEED } from '@/lib/education/evaluations';
import type { HistoryEvent, MemberProfileExtras } from '@/lib/education/history';
import {
  DEFAULT_EXTRAS,
  EXTRAS_SEED,
  HISTORY_SEED,
  synthesiseHistory,
} from '@/lib/education/history';
import type { Member } from '@/lib/education/members';
import { SEED_MEMBERS } from '@/lib/education/members';
import type { SpeechSlotRequest } from '@/lib/education/speech-slot-requests';
import { SEED_SPEECH_SLOT_REQUESTS } from '@/lib/education/speech-slot-requests';
import type { BudgetLine } from '@/lib/finance/budget';
import { SEED_BUDGET_LINES } from '@/lib/finance/budget';
import type { DuesRecord } from '@/lib/finance/dues';
import { SEED_DUES_RECORDS } from '@/lib/finance/dues';
import type { Transaction } from '@/lib/finance/transactions';
import { SEED_TRANSACTIONS } from '@/lib/finance/transactions';
import type { ChecklistItem } from '@/lib/inventory/checklist';
import type { InventoryItem } from '@/lib/inventory/inventory-items';
import { SEED_INVENTORY_ITEMS } from '@/lib/inventory/inventory-items';
import type { Asset } from '@/lib/library/assets';
import { SEED_ASSETS } from '@/lib/library/assets';
import type { LibraryDocument } from '@/lib/library/documents';
import { SEED_DOCUMENTS } from '@/lib/library/documents';
import type { AhCounterEntry } from '@/lib/meetings/ah-counter-reports';
import { AH_COUNTER_ENTRY_SEED } from '@/lib/meetings/ah-counter-reports';
import type { Meeting } from '@/lib/meetings/meetings';
import { SEED_MEETINGS } from '@/lib/meetings/meetings';
import type { TimerEntry } from '@/lib/meetings/timer-reports';
import { TIMER_ENTRY_SEED } from '@/lib/meetings/timer-reports';
import type { ContactLog } from '@/lib/people/contact-logs';
import { SEED_CONTACT_LOGS } from '@/lib/people/contact-logs';
import type { Guest } from '@/lib/people/guests';
import { SEED_GUESTS } from '@/lib/people/guests';
import type { VisitLog } from '@/lib/people/visit-logs';
import { SEED_VISIT_LOGS } from '@/lib/people/visit-logs';
import type { Task } from '@/lib/tasks/tasks';
import { SEED_TASKS } from '@/lib/tasks/tasks';

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
 * v5 introduced the visit-logs table backing the Visit logs drawer.
 * v6 introduced the assets table backing the Library > Assets tab.
 * v7 introduced the documents table backing the Library > Documents tab.
 * v8 introduced the checklists (per meeting) and inventory-items tables
 *    backing the Inventory & checklist page.
 * v9 introduced the transactions, dues-records and budget-lines tables
 *    backing the Finance (treasurer) page.
 * v10 introduced the evaluations, timer-entries, ah-counter-entries,
 *    speech-slot-requests and tasks tables backing the Me page.
 * v11 introduced the activity-logs table backing the Activity Logs page. */
const SCHEMA_VERSION = 'v11';

export const DB_KEYS = {
  members: `toastly.db.${SCHEMA_VERSION}.members`,
  historyEvents: `toastly.db.${SCHEMA_VERSION}.history-events`,
  memberExtras: `toastly.db.${SCHEMA_VERSION}.member-extras`,
  meetings: `toastly.db.${SCHEMA_VERSION}.meetings`,
  guests: `toastly.db.${SCHEMA_VERSION}.guests`,
  contactLogs: `toastly.db.${SCHEMA_VERSION}.contact-logs`,
  visitLogs: `toastly.db.${SCHEMA_VERSION}.visit-logs`,
  assets: `toastly.db.${SCHEMA_VERSION}.assets`,
  documents: `toastly.db.${SCHEMA_VERSION}.documents`,
  checklists: `toastly.db.${SCHEMA_VERSION}.checklists`,
  inventoryItems: `toastly.db.${SCHEMA_VERSION}.inventory-items`,
  transactions: `toastly.db.${SCHEMA_VERSION}.transactions`,
  duesRecords: `toastly.db.${SCHEMA_VERSION}.dues-records`,
  budgetLines: `toastly.db.${SCHEMA_VERSION}.budget-lines`,
  evaluations: `toastly.db.${SCHEMA_VERSION}.evaluations`,
  timerEntries: `toastly.db.${SCHEMA_VERSION}.timer-entries`,
  ahCounterEntries: `toastly.db.${SCHEMA_VERSION}.ah-counter-entries`,
  speechSlotRequests: `toastly.db.${SCHEMA_VERSION}.speech-slot-requests`,
  tasks: `toastly.db.${SCHEMA_VERSION}.tasks`,
  activityLogs: `toastly.db.${SCHEMA_VERSION}.activity-logs`,
} as const;

/** Used by the cross-tab sync listener to tell our writes apart from any other
 * localStorage traffic on the origin. */
export const DB_KEY_LIST: readonly string[] = Object.values(DB_KEYS);

type MemberExtrasTable = Record<string, MemberProfileExtras>;

/** One row per meeting — the checklist rows the meeting owns. Absent
 * meetings return an empty list and are seeded on first write. */
export type ChecklistsTable = Record<string, ChecklistItem[]>;

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

function seedAssets(): Asset[] {
  return SEED_ASSETS;
}

function seedDocuments(): LibraryDocument[] {
  return SEED_DOCUMENTS;
}

function seedChecklists(): ChecklistsTable {
  /* Empty by default — the first read for a given meeting seeds that meeting's
   * row with the default checklist so a returning user's edits are never
   * overwritten by the seed data. */
  return {};
}

function seedInventoryItems(): InventoryItem[] {
  return SEED_INVENTORY_ITEMS;
}

function seedTransactions(): Transaction[] {
  return SEED_TRANSACTIONS;
}

function seedDuesRecords(): DuesRecord[] {
  return SEED_DUES_RECORDS;
}

function seedBudgetLines(): BudgetLine[] {
  return SEED_BUDGET_LINES;
}

function seedEvaluations(): Evaluation[] {
  return SEED_MEMBERS.flatMap((member) => EVALUATION_SEED[member.id] ?? []);
}

function seedTimerEntries(): TimerEntry[] {
  return SEED_MEMBERS.flatMap((member) => TIMER_ENTRY_SEED[member.id] ?? []);
}

function seedAhCounterEntries(): AhCounterEntry[] {
  return SEED_MEMBERS.flatMap((member) => AH_COUNTER_ENTRY_SEED[member.id] ?? []);
}

function seedSpeechSlotRequests(): SpeechSlotRequest[] {
  return SEED_SPEECH_SLOT_REQUESTS;
}

function seedTasks(): Task[] {
  return SEED_TASKS;
}

function seedActivityLogs(): ActivityLog[] {
  return SEED_ACTIVITY_LOGS;
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

export function readAssets(): Asset[] {
  return readTable(DB_KEYS.assets, seedAssets);
}

export function writeAssets(assets: Asset[]): void {
  writeTable(DB_KEYS.assets, assets);
}

export function readDocuments(): LibraryDocument[] {
  return readTable(DB_KEYS.documents, seedDocuments);
}

export function writeDocuments(docs: LibraryDocument[]): void {
  writeTable(DB_KEYS.documents, docs);
}

export function readChecklists(): ChecklistsTable {
  return readTable(DB_KEYS.checklists, seedChecklists);
}

export function writeChecklists(checklists: ChecklistsTable): void {
  writeTable(DB_KEYS.checklists, checklists);
}

export function readInventoryItems(): InventoryItem[] {
  return readTable(DB_KEYS.inventoryItems, seedInventoryItems);
}

export function writeInventoryItems(items: InventoryItem[]): void {
  writeTable(DB_KEYS.inventoryItems, items);
}

export function readTransactions(): Transaction[] {
  return readTable(DB_KEYS.transactions, seedTransactions);
}

export function writeTransactions(transactions: Transaction[]): void {
  writeTable(DB_KEYS.transactions, transactions);
}

export function readDuesRecords(): DuesRecord[] {
  return readTable(DB_KEYS.duesRecords, seedDuesRecords);
}

export function writeDuesRecords(records: DuesRecord[]): void {
  writeTable(DB_KEYS.duesRecords, records);
}

export function readBudgetLines(): BudgetLine[] {
  return readTable(DB_KEYS.budgetLines, seedBudgetLines);
}

export function writeBudgetLines(lines: BudgetLine[]): void {
  writeTable(DB_KEYS.budgetLines, lines);
}

export function readEvaluations(): Evaluation[] {
  return readTable(DB_KEYS.evaluations, seedEvaluations);
}

export function readTimerEntries(): TimerEntry[] {
  return readTable(DB_KEYS.timerEntries, seedTimerEntries);
}

export function readAhCounterEntries(): AhCounterEntry[] {
  return readTable(DB_KEYS.ahCounterEntries, seedAhCounterEntries);
}

export function readSpeechSlotRequests(): SpeechSlotRequest[] {
  return readTable(DB_KEYS.speechSlotRequests, seedSpeechSlotRequests);
}

export function writeSpeechSlotRequests(requests: SpeechSlotRequest[]): void {
  writeTable(DB_KEYS.speechSlotRequests, requests);
}

export function readTasks(): Task[] {
  return readTable(DB_KEYS.tasks, seedTasks);
}

export function writeTasks(tasks: Task[]): void {
  writeTable(DB_KEYS.tasks, tasks);
}

export function readActivityLogs(): ActivityLog[] {
  return readTable(DB_KEYS.activityLogs, seedActivityLogs);
}

export function writeActivityLogs(logs: ActivityLog[]): void {
  writeTable(DB_KEYS.activityLogs, logs);
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
