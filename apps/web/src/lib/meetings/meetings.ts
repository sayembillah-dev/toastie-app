export const MEETING_STATUSES = ['draft', 'published'] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export interface Meeting {
  id: string;
  meetingNumber: number;
  /** ISO string — the meeting's start. Held as a full timestamp so cards can
   * render both the date and the time without a second field. */
  dateTime: string;
  theme: string;
  status: MeetingStatus;
}

/** Weekly meetings from May through mid-September 2026. The dataset is written
 * relative to a "today" of 2026-08-02: nine meetings sit in the past, and the
 * next one lands on 2026-08-05 so the Current tab always has a card to feature. */
export const SEED_MEETINGS: Meeting[] = [
  {
    id: 'mtg-001',
    meetingNumber: 41,
    dateTime: '2026-05-06T19:00:00',
    theme: 'Spring Awakening',
    status: 'published',
  },
  {
    id: 'mtg-002',
    meetingNumber: 42,
    dateTime: '2026-05-13T19:00:00',
    theme: 'Voices of the Community',
    status: 'published',
  },
  {
    id: 'mtg-003',
    meetingNumber: 43,
    dateTime: '2026-05-20T19:00:00',
    theme: 'Storytelling Through Time',
    status: 'published',
  },
  {
    id: 'mtg-004',
    meetingNumber: 44,
    dateTime: '2026-05-27T19:00:00',
    theme: 'The Art of Persuasion',
    status: 'published',
  },
  {
    id: 'mtg-005',
    meetingNumber: 45,
    dateTime: '2026-06-03T19:00:00',
    theme: 'Bridges & Breakthroughs',
    status: 'published',
  },
  {
    id: 'mtg-006',
    meetingNumber: 46,
    dateTime: '2026-06-17T19:00:00',
    theme: 'Journeys Worth Sharing',
    status: 'published',
  },
  {
    id: 'mtg-007',
    meetingNumber: 47,
    dateTime: '2026-07-01T19:00:00',
    theme: 'Innovation on the Table',
    status: 'published',
  },
  {
    id: 'mtg-008',
    meetingNumber: 48,
    dateTime: '2026-07-15T19:00:00',
    theme: 'Under the Summer Sun',
    status: 'published',
  },
  {
    id: 'mtg-009',
    meetingNumber: 49,
    dateTime: '2026-07-29T19:00:00',
    theme: 'Small Habits, Big Wins',
    status: 'published',
  },
  {
    id: 'mtg-010',
    meetingNumber: 50,
    dateTime: '2026-08-05T19:00:00',
    theme: 'Fifty & Forward',
    status: 'published',
  },
  {
    id: 'mtg-011',
    meetingNumber: 51,
    dateTime: '2026-08-12T19:00:00',
    theme: 'Leaders in the Making',
    status: 'published',
  },
  {
    id: 'mtg-012',
    meetingNumber: 52,
    dateTime: '2026-08-19T19:00:00',
    theme: 'Cross-Cultural Conversations',
    status: 'draft',
  },
  {
    id: 'mtg-013',
    meetingNumber: 53,
    dateTime: '2026-08-26T19:00:00',
    theme: 'Humour & the Human Side',
    status: 'draft',
  },
  {
    id: 'mtg-014',
    meetingNumber: 54,
    dateTime: '2026-09-02T19:00:00',
    theme: 'Autumn Perspectives',
    status: 'draft',
  },
  {
    id: 'mtg-015',
    meetingNumber: 55,
    dateTime: '2026-09-09T19:00:00',
    theme: 'The Power of Storycraft',
    status: 'draft',
  },
];

/** Everything the create form collects. The id is minted by the API, not the
 * client, so it is deliberately absent here — and so is `status`: a meeting is
 * born a draft and only leaves that state from the Publish action on its own
 * page. */
export interface CreateMeetingInput {
  meetingNumber: number;
  dateTime: string;
  theme: string;
}

/** What the meeting page's Save as Draft / Publish buttons commit: the status
 * they set, plus the fields the working draft owns on the meeting record. */
export interface UpdateMeetingInput {
  status: MeetingStatus;
  theme?: string;
}

/** The club meets in the evening, so the create form starts here and lets the
 * user override rather than making them type the same time every week. */
export const DEFAULT_START_TIME = '19:00';

/** One past the highest number on the roster — what the create form pre-fills.
 * Derived rather than stored so a deleted meeting never leaves a gap that the
 * next create silently reuses. */
export function nextMeetingNumber(meetings: Meeting[]): number {
  return meetings.reduce((highest, meeting) => Math.max(highest, meeting.meetingNumber), 0) + 1;
}

/** Split a roster into past / current-next / upcoming buckets. `now` is passed
 * in so the caller controls the clock — components read `Date.now()` once and
 * feed the same instant through, keeping the split stable across a render. */
export function partitionMeetings(
  meetings: Meeting[],
  now: number,
): { past: Meeting[]; current: Meeting | null; upcoming: Meeting[] } {
  const sorted = [...meetings].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
  );

  const past: Meeting[] = [];
  const upcoming: Meeting[] = [];
  for (const meeting of sorted) {
    if (new Date(meeting.dateTime).getTime() < now) {
      past.push(meeting);
    } else {
      upcoming.push(meeting);
    }
  }

  return {
    past: past.reverse(), // Latest past first — makes the recap read top-down.
    current: upcoming[0] ?? null,
    upcoming,
  };
}
