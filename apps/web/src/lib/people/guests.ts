/** The pipeline a guest moves along, from a name on a list to a paid-up member.
 * Ordered — the Kanban board renders the columns in exactly this sequence, and
 * `not-interested` sits last as the parking bay rather than a final step. */
/* `accent` is the column dot; `soft` is the tinted chip behind it — the pair is
 * pre-mixed rather than derived so both stay legible against white. */
export const GUEST_STAGES = [
  { id: 'new', label: 'New', accent: '#64748B', soft: '#F1F5F9' },
  { id: 'contacted', label: 'Contacted', accent: '#B45309', soft: '#FEF3C7' },
  { id: 'interested', label: 'Interested', accent: '#0369A1', soft: '#E0F2FE' },
  { id: 'joined-meetings', label: 'Joined Meeting(s)', accent: '#6D28D9', soft: '#EDE9FE' },
  { id: 'joined-club', label: 'Joined Club', accent: '#047857', soft: '#D1FAE5' },
  { id: 'not-interested', label: 'Not Interested', accent: '#8A8A8A', soft: '#F2F2F2' },
] as const;

export type GuestStage = (typeof GUEST_STAGES)[number]['id'];

export const GUEST_STAGE_IDS: readonly GuestStage[] = GUEST_STAGES.map((stage) => stage.id);

export const DEFAULT_GUEST_STAGE: GuestStage = 'new';

export function isGuestStage(value: unknown): value is GuestStage {
  return GUEST_STAGE_IDS.includes(value as GuestStage);
}

export function getGuestStage(stage: GuestStage): (typeof GUEST_STAGES)[number] {
  return GUEST_STAGES.find((entry) => entry.id === stage) ?? GUEST_STAGES[0];
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  /** ISO date (YYYY-MM-DD) of their first visit to the club. */
  firstVisit: string;
  /** ISO date (YYYY-MM-DD) of the most recent visit; equal to firstVisit on day one. */
  lastVisit: string;
  /** Total number of meetings attended so far. */
  visitCount: number;
  /** Free-text name of the member or contact who brought them along. */
  invitedBy?: string;
  /** Where they sit in the follow-up pipeline; the Kanban column they land in. */
  stage: GuestStage;
}

/** Buckets guests into one list per stage, in board order. Guests carrying a
 * stage we no longer ship fall back to New rather than vanishing. */
export function groupGuestsByStage(guests: readonly Guest[]): Record<GuestStage, Guest[]> {
  const grouped = Object.fromEntries(
    GUEST_STAGE_IDS.map((stage) => [stage, [] as Guest[]]),
  ) as Record<GuestStage, Guest[]>;

  for (const guest of guests) {
    grouped[isGuestStage(guest.stage) ? guest.stage : DEFAULT_GUEST_STAGE].push(guest);
  }
  return grouped;
}

export const SEED_GUESTS: Guest[] = [
  {
    id: 'g-01',
    firstName: 'Elena',
    lastName: 'Vasquez',
    email: 'elena.vasquez@example.com',
    firstVisit: '2026-07-08',
    lastVisit: '2026-07-22',
    visitCount: 2,
    invitedBy: 'Aisha Patel',
    stage: 'interested',
  },
  {
    id: 'g-02',
    firstName: 'Jamal',
    lastName: 'Osei',
    email: 'jamal.osei@example.com',
    firstVisit: '2026-07-22',
    lastVisit: '2026-07-22',
    visitCount: 1,
    invitedBy: 'Marcus Chen',
    stage: 'new',
  },
  {
    id: 'g-03',
    firstName: 'Mei',
    lastName: 'Tanaka',
    firstVisit: '2026-06-24',
    lastVisit: '2026-07-22',
    visitCount: 3,
    invitedBy: 'Priya Sharma',
    stage: 'joined-meetings',
  },
  {
    id: 'g-04',
    firstName: 'Lucas',
    lastName: 'Fernandez',
    email: 'lucas.f@example.com',
    firstVisit: '2026-07-15',
    lastVisit: '2026-07-15',
    visitCount: 1,
    stage: 'contacted',
  },
  {
    id: 'g-05',
    firstName: 'Ada',
    lastName: 'Onyekachi',
    email: 'ada.o@example.com',
    firstVisit: '2026-05-13',
    lastVisit: '2026-07-08',
    visitCount: 4,
    invitedBy: 'Grace Okafor',
    stage: 'joined-club',
  },
  {
    id: 'g-06',
    firstName: 'Henrik',
    lastName: 'Sørensen',
    firstVisit: '2026-07-01',
    lastVisit: '2026-07-15',
    visitCount: 2,
    invitedBy: 'Nathan Brooks',
    stage: 'not-interested',
  },
];

export function getGuestInitials(guest: Pick<Guest, 'firstName' | 'lastName'>): string {
  return `${guest.firstName.charAt(0)}${guest.lastName.charAt(0)}`.toUpperCase();
}

const AVATAR_PALETTE = [
  { bg: '#FFE4E6', fg: '#881337' },
  { bg: '#FEF3C7', fg: '#78350F' },
  { bg: '#ECFCCB', fg: '#365314' },
  { bg: '#D1FAE5', fg: '#064E3B' },
  { bg: '#CFFAFE', fg: '#164E63' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#E0E7FF', fg: '#312E81' },
  { bg: '#EDE9FE', fg: '#4C1D95' },
  { bg: '#FAE8FF', fg: '#701A75' },
  { bg: '#FCE7F3', fg: '#831843' },
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Derived from the id so a guest keeps the same avatar colour wherever they
 * are drawn — card grid, Kanban column or mobile row. */
export function getGuestSwatch(guestId: string): (typeof AVATAR_PALETTE)[number] {
  return AVATAR_PALETTE[hashString(guestId) % AVATAR_PALETTE.length];
}
