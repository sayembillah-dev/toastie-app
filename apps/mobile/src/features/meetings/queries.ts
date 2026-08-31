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
      .filter((m) => m.status === 'published' && new Date(m.dateTime).getTime() >= now)
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())[0] ?? null
  );
}

export function sortByDateDescending(meetings: MeetingSummary[]): MeetingSummary[] {
  return [...meetings].sort(
    (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(),
  );
}
