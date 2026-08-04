/** Contact log — one row per outreach touch. The Contact logs panel on the
 * guest profile writes these; the same records will front the mailing-list
 * builder later on. */

/** Every way an officer might reach a guest. `other` is the escape hatch —
 * WhatsApp voice, LinkedIn DM, a chat in the pub — that survives the drop-down
 * without needing a new enum value every time. */
export const CONTACT_METHODS = [
  { id: 'call', label: 'Call' },
  { id: 'message', label: 'Message' },
  { id: 'email', label: 'Email' },
  { id: 'in-person', label: 'In person' },
  { id: 'other', label: 'Other' },
] as const;

export type ContactMethod = (typeof CONTACT_METHODS)[number]['id'];

export const CONTACT_METHOD_IDS: readonly ContactMethod[] = CONTACT_METHODS.map(
  (entry) => entry.id,
);

export function isContactMethod(value: unknown): value is ContactMethod {
  return CONTACT_METHOD_IDS.includes(value as ContactMethod);
}

export function getContactMethod(id: ContactMethod): (typeof CONTACT_METHODS)[number] {
  return (
    CONTACT_METHODS.find((entry) => entry.id === id) ?? CONTACT_METHODS[CONTACT_METHODS.length - 1]
  );
}

/** Hard cap on the outcome text so a runaway paste can't blow up localStorage.
 * The form's char counter mirrors this value. */
export const CONTACT_LOG_OUTCOME_MAX = 2000;

export interface ContactLog {
  id: string;
  guestId: string;
  method: ContactMethod;
  /** "What happened next?" — freeform prose recorded by the officer. */
  outcome: string;
  /** ISO datetime the log was created. Drives the sort order (latest first). */
  createdAt: string;
  /** Present only when the log has been edited — powers the "edited" hint on
   * the card. */
  updatedAt?: string;
}

export interface CreateContactLogInput {
  method: ContactMethod;
  outcome: string;
}

/** Both fields are optional so the API can accept partial patches, but the
 * edit form always sends the full pair — that's the shape the officer sees. */
export interface UpdateContactLogInput {
  method?: ContactMethod;
  outcome?: string;
}

/** Newest-first order — the drawer relies on the server to sort so client-side
 * sorting stays a single call site. */
export function sortContactLogsNewestFirst(logs: readonly ContactLog[]): ContactLog[] {
  return [...logs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export const SEED_CONTACT_LOGS: ContactLog[] = [
  {
    id: 'g-01-log-a',
    guestId: 'g-01',
    method: 'in-person',
    outcome:
      'Chatted after the 22 July meeting — Elena is keen on Presentation Mastery but wants to sit in on one more session before signing up. Mentioned she has been avoiding client demos and is here to get past that.',
    createdAt: '2026-07-22T21:04:00.000Z',
  },
  {
    id: 'g-01-log-b',
    guestId: 'g-01',
    method: 'call',
    outcome:
      'Left a voicemail introducing the mentorship track and asking about her availability for the next intro session.',
    createdAt: '2026-07-24T14:32:00.000Z',
  },
  {
    id: 'g-01-log-c',
    guestId: 'g-01',
    method: 'email',
    outcome:
      'Sent the pathways brochure and confirmed the pilot cohort still has two openings for October. Cc-ed the VP Membership.',
    createdAt: '2026-07-26T09:18:00.000Z',
  },
];
