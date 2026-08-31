/**
 * The dashboard's four blocks (docs/PRD.md section 7): next-meeting countdown, club
 * activity pulse, the signed-in member's upcoming assignments, and their most
 * recent speech.
 *
 * There is no dashboard endpoint in docs/TDD.md section 5's route map, so this
 * composes the existing resources client-side. That is three requests where one
 * would do; if the dashboard turns out to be the app's slowest screen on club
 * mobile data, a purpose-built aggregate endpoint is the fix, not more caching
 * here.
 */

import { useQuery } from '@tanstack/react-query';
import type { HistoryEvent, Meeting, MeetingSummary } from '@/api';
import { fetchActivityLog, fetchMemberHistory } from '@/api';
import { nextMeeting, useMeeting, useMeetings } from '@/features/meetings/queries';
import { useScopedKey } from '@/features/shared/scoped-query';
import { useCan, useSession } from '@/session';

export type UpcomingAssignment =
  | { kind: 'role'; roleKey: string }
  | { kind: 'speech'; order: number; title: string | null; project: string | null }
  | { kind: 'evaluation'; order: number; speakerName: string };

/** A stable identity for an assignment, for React keys. Every variant is
 * unique within one meeting: a member holds a given role once, and speech and
 * evaluation slots are numbered. */
export function assignmentKey(assignment: UpcomingAssignment): string {
  return assignment.kind === 'role'
    ? `role:${assignment.roleKey}`
    : `${assignment.kind}:${assignment.order}`;
}

/** What the signed-in member is down to do at a given meeting. */
export function assignmentsFor(
  meeting: Meeting | undefined,
  membershipId: string | null,
): UpcomingAssignment[] {
  if (!meeting || !membershipId) return [];

  const assignments: UpcomingAssignment[] = [];

  for (const role of meeting.roleAssignments) {
    if (role.actor?.membershipId === membershipId) {
      assignments.push({ kind: 'role', roleKey: role.roleKey });
    }
  }

  for (const slot of meeting.speakers) {
    if (slot.speaker?.membershipId === membershipId) {
      assignments.push({
        kind: 'speech',
        order: slot.order,
        title: slot.title,
        project: slot.project,
      });
    }
    if (slot.evaluator?.membershipId === membershipId) {
      assignments.push({
        kind: 'evaluation',
        order: slot.order,
        speakerName: slot.speaker?.name ?? 'a speaker',
      });
    }
  }

  return assignments;
}

export function mostRecentSpeech(history: HistoryEvent[] | undefined): HistoryEvent | null {
  if (!history?.length) return null;
  return (
    history
      .filter((event) => event.type === 'speechGiven')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null
  );
}

export function useDashboard() {
  const { activeContext } = useSession();
  const can = useCan();
  const club = activeContext?.kind === 'club' ? activeContext : null;
  const membershipId = club?.membershipId ?? null;

  const meetingsQuery = useMeetings();
  const next: MeetingSummary | null = nextMeeting(meetingsQuery.data);

  // The list endpoint returns summaries; role assignments and speaker slots
  // only come with the full record, so the next meeting is fetched again.
  const nextMeetingQuery = useMeeting(next?.id);

  const activityQuery = useQuery({
    queryKey: useScopedKey('activity-logs'),
    queryFn: fetchActivityLog,
    enabled: can('read', 'activityLog'),
  });

  // `ownerMembershipId` is what makes an `own`-scoped grant match — an ordinary
  // member may read their own education record and no one else's, and this is
  // the same target shape the API's service layer passes to `can()`.
  const historyQuery = useQuery({
    queryKey: useScopedKey('history', membershipId),
    queryFn: () => fetchMemberHistory(membershipId as string),
    enabled:
      !!club &&
      can('read', 'education', { clubId: club.clubId, ownerMembershipId: club.membershipId }),
  });

  return {
    nextMeeting: next,
    nextMeetingDetail: nextMeetingQuery.data,
    assignments: assignmentsFor(nextMeetingQuery.data, membershipId),
    activity: activityQuery.data?.slice(0, 8) ?? [],
    recentSpeech: mostRecentSpeech(historyQuery.data),
    isLoading: meetingsQuery.isLoading,
    error: meetingsQuery.error,
    refetch: () => {
      void meetingsQuery.refetch();
      void activityQuery.refetch();
      void historyQuery.refetch();
    },
    isRefetching: meetingsQuery.isRefetching,
  };
}
