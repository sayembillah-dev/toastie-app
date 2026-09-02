import type { WordOfTheDay } from '@/lib/meetings/draft';

export const MEETING_STATUSES = ['draft', 'published'] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export interface Meeting {
  id: string;
  /** Tenant boundary — the club this meeting belongs to. */
  clubId: string;
  meetingNumber: number;
  /** ISO string — the meeting's start. Held as a full timestamp so cards can
   * render both the date and the time without a second field. */
  dateTime: string;
  theme: string;
  /** The grammarian's word of the day. Absent until the Theme tab has been
   * saved — consumers treat that as an empty form. */
  word?: WordOfTheDay;
  status: MeetingStatus;
  /** Opaque credential used by anonymous share links —
   * `/meetings/:id/roles/:kind?t=<shareToken>` and the equivalent
   * `/evaluate/:speakerId` route. The token IS the capability; anyone with
   * the link can view the shared page, so it is only ever included in
   * links the meeting organiser generates. */
  shareToken: string;
}

/** Minimal projection served by `/public/meetings/:id?t=<token>` — the
 * anonymous share pages read this instead of `useGetMeetingQuery` (which
 * requires auth). No clubId, no status, no shareToken (the caller
 * already has it) — just what the header needs to render. */
export interface PublicMeeting {
  id: string;
  meetingNumber: number;
  dateTime: string;
  theme: string;
  clubName: string;
  /** Word of the day — null until the Theme tab sets one; the public
   * Grammarian page tallies its usage. */
  word: string | null;
}

/** Minimal projection served by
 * `/public/meetings/:id/speakers/:speakerId?t=<token>` — backs the
 * evaluation form's header. Gated by the same share token as `PublicMeeting`
 * rather than `published` status, since the evaluation link is meant to
 * work while the meeting is still a draft. */
export interface PublicSpeaker {
  id: string;
  title: string;
  pathway: string | null;
  project: string | null;
  duration: number | null;
  speakerName: string;
  evaluatorName: string;
}

/** Minimal projection served by `/public/meetings/:id/roles/:role?t=<token>`
 * — backs the Ah Counter/Timer/Grammarian pages' identity gate. `name` is
 * `''` when nobody is assigned to that role yet. */
export interface PublicRoleAssignment {
  roleKey: string;
  name: string;
}

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
 * they set, plus the fields the working draft owns on the meeting record.
 * `meetingNumber`/`dateTime` back the Overview tab's number/date editor —
 * omitted, they're left untouched, same as every other field here. */
export interface UpdateMeetingInput {
  meetingNumber?: number;
  dateTime?: string;
  status?: MeetingStatus;
  theme?: string;
  /** Sent whole. An empty `word` clears the stored block; omitting the key
   * entirely leaves it untouched. */
  word?: WordOfTheDay;
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
