/** Visit log — one row per meeting a guest turned up to. Fed both by the
 * automatic path (guest named on a meeting agenda) and by hand from the profile
 * drawer. Every visit points at a meeting; the meeting id is the source of the
 * date and theme, so the log row itself carries only what the officer types. */

export const VISIT_LOG_ORIGINS = ['meeting', 'manual'] as const;

export type VisitLogOrigin = (typeof VISIT_LOG_ORIGINS)[number];

export function isVisitLogOrigin(value: unknown): value is VisitLogOrigin {
  return VISIT_LOG_ORIGINS.includes(value as VisitLogOrigin);
}

export interface VisitLog {
  id: string;
  /** Tenant boundary — copied from the owning guest's club at creation. */
  clubId: string;
  guestId: string;
  /** The meeting the guest attended. Deleting the meeting doesn't cascade — the
   * drawer falls back to a "meeting no longer on file" line so historical
   * attendance survives a data-model refactor. */
  meetingId: string;
  /** What the guest did at the meeting — "Guest", "Table Topics speaker",
   * "Prepared speaker", etc. Freeform so the club can invent new labels
   * without a schema change. */
  role?: string;
  /** Anything the officer wants to remember about the visit. */
  notes?: string;
  /** 'meeting' when the log was created automatically from a meeting agenda
   * naming this guest; 'manual' when someone added it by hand from the profile
   * drawer. Either kind can be edited or deleted. */
  origin: VisitLogOrigin;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateVisitLogInput {
  meetingId: string;
  role?: string;
  notes?: string;
}

/** Partial patch — the drawer sends the full set today, but the API stays
 * generic so a future "just fix the role" write doesn't need a new endpoint. */
export interface UpdateVisitLogInput {
  meetingId?: string;
  role?: string;
  notes?: string;
}

export const VISIT_LOG_NOTES_MAX = 2000;
export const VISIT_LOG_ROLE_MAX = 80;

/** The default role for a guest who just turned up to observe — matches the
 * agenda's "Welcome guests" language so the label reads naturally. */
export const DEFAULT_VISIT_ROLE = 'Guest';

/** Common labels the club is likely to reach for. The role field is a plain
 * text input so anything works, but these feed the drawer's auto-complete
 * suggestions so the frequent picks are one keypress away. */
export const COMMON_VISIT_ROLES: readonly string[] = [
  'Guest',
  'Table Topics speaker',
  'Prepared speaker',
  'Evaluator',
  'Timer',
  'Ah Counter',
  'Grammarian',
  'Shadowing',
];

/** Seed visits mirroring the guests' `visitCount` figures. Meeting ids point at
 * entries in `SEED_MEETINGS` so the drawer can render real dates and themes on
 * first load. All origins are 'meeting' — these stand in for the automatic
 * agenda-driven writes that will land once meeting agendas track named guests. */
export const SEED_VISIT_LOGS: Omit<VisitLog, 'clubId'>[] = [
  // Elena Vasquez — 2 visits, warming toward Presentation Mastery.
  {
    id: 'g-01-visit-a',
    guestId: 'g-01',
    meetingId: 'mtg-007',
    role: 'Guest',
    origin: 'meeting',
    createdAt: '2026-07-01T21:00:00.000Z',
  },
  {
    id: 'g-01-visit-b',
    guestId: 'g-01',
    meetingId: 'mtg-008',
    role: 'Table Topics speaker',
    notes: 'Volunteered on the night — answered a prompt on "unexpected mentors".',
    origin: 'meeting',
    createdAt: '2026-07-15T21:00:00.000Z',
  },

  // Jamal Osei — first-time visitor.
  {
    id: 'g-02-visit-a',
    guestId: 'g-02',
    meetingId: 'mtg-008',
    role: 'Guest',
    origin: 'meeting',
    createdAt: '2026-07-15T21:00:00.000Z',
  },

  // Mei Tanaka — 3 visits, working up to full speaking projects.
  {
    id: 'g-03-visit-a',
    guestId: 'g-03',
    meetingId: 'mtg-006',
    role: 'Guest',
    origin: 'meeting',
    createdAt: '2026-06-17T21:00:00.000Z',
  },
  {
    id: 'g-03-visit-b',
    guestId: 'g-03',
    meetingId: 'mtg-007',
    role: 'Guest',
    origin: 'meeting',
    createdAt: '2026-07-01T21:00:00.000Z',
  },
  {
    id: 'g-03-visit-c',
    guestId: 'g-03',
    meetingId: 'mtg-008',
    role: 'Table Topics speaker',
    notes: 'Delivered a strong 90-second answer — first time she stayed on the stage that long.',
    origin: 'meeting',
    createdAt: '2026-07-15T21:00:00.000Z',
  },

  // Lucas Fernandez — one visit.
  {
    id: 'g-04-visit-a',
    guestId: 'g-04',
    meetingId: 'mtg-008',
    role: 'Guest',
    origin: 'meeting',
    createdAt: '2026-07-15T21:00:00.000Z',
  },

  // Ada Onyekachi — joined the club after 4 visits.
  {
    id: 'g-05-visit-a',
    guestId: 'g-05',
    meetingId: 'mtg-003',
    role: 'Guest',
    origin: 'meeting',
    createdAt: '2026-05-20T21:00:00.000Z',
  },
  {
    id: 'g-05-visit-b',
    guestId: 'g-05',
    meetingId: 'mtg-005',
    role: 'Guest',
    origin: 'meeting',
    createdAt: '2026-06-03T21:00:00.000Z',
  },
  {
    id: 'g-05-visit-c',
    guestId: 'g-05',
    meetingId: 'mtg-007',
    role: 'Table Topics speaker',
    origin: 'meeting',
    createdAt: '2026-07-01T21:00:00.000Z',
  },
  {
    id: 'g-05-visit-d',
    guestId: 'g-05',
    meetingId: 'mtg-008',
    role: 'Prepared speaker',
    notes: 'Delivered her Ice Breaker — nailed it. Joined the following week.',
    origin: 'meeting',
    createdAt: '2026-07-15T21:00:00.000Z',
  },

  // Henrik Sørensen — 2 visits before deciding not to continue.
  {
    id: 'g-06-visit-a',
    guestId: 'g-06',
    meetingId: 'mtg-007',
    role: 'Guest',
    origin: 'meeting',
    createdAt: '2026-07-01T21:00:00.000Z',
  },
  {
    id: 'g-06-visit-b',
    guestId: 'g-06',
    meetingId: 'mtg-008',
    role: 'Guest',
    origin: 'meeting',
    createdAt: '2026-07-15T21:00:00.000Z',
  },
];
