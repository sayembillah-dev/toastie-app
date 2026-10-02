import { useQuery } from '@tanstack/react-query';
import type { MeetingSummary } from '@/api';
import { fetchMeeting, fetchMeetings, fetchPublicMeeting } from '@/api';
import { useScopedKey } from '@/features/shared/scoped-query';
import { useCan } from '@/session';

export function useMeetings() {
  const can = useCan();
  const key = useScopedKey('meetings');

  return useQuery({
    queryKey: key,
    queryFn: fetchMeetings,
    // Asking for a list the role cannot read only produces a 403 to render.
    enabled: can('read', 'meeting'),
  });
}

export function useMeeting(meetingId: string | undefined) {
  const key = useScopedKey('meeting', meetingId);

  return useQuery({
    queryKey: key,
    queryFn: () => fetchMeeting(meetingId as string),
    enabled: !!meetingId,
  });
}

/** The share-link agenda. Unscoped by design — there is no context to scope it by. */
export function usePublicMeeting(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['public-meeting', meetingId],
    queryFn: () => fetchPublicMeeting(meetingId as string),
    enabled: !!meetingId,
  });
}

/** A meeting stays current for this long after it starts — it only counts as
 * past once its start time plus this window has gone by. */
export const MEETING_PAST_AFTER_MS = 2 * 60 * 60 * 1000;

/** Whether a meeting has moved to the past at `now` (start + 2 hours). */
export function isMeetingPast(meeting: Pick<MeetingSummary, 'dateTime'>, now: number): boolean {
  return new Date(meeting.dateTime).getTime() + MEETING_PAST_AFTER_MS <= now;
}

/**
 * The next meeting the club will actually hold.
 *
 * Drafts are excluded: an unpublished agenda is a work in progress, and
 * counting down to one would promise members a meeting the officers have not
 * committed to yet (docs/ERD.md section 3, `MeetingStatus`).
 */
export function nextMeeting(meetings: MeetingSummary[] | undefined): MeetingSummary | null {
  if (!meetings?.length) return null;
  const now = Date.now();
  return (
    meetings
      .filter((m) => m.status === 'published' && !isMeetingPast(m, now))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())[0] ?? null
  );
}

export function sortByDateDescending(meetings: MeetingSummary[]): MeetingSummary[] {
  return [...meetings].sort(
    (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(),
  );
}
