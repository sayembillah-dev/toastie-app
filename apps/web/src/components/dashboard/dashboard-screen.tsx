'use client';

import { WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { skipToken } from '@reduxjs/toolkit/query/react';

import { ClubStandingCard } from '@/components/me/club-standing-card';
import { FinanceCard } from '@/components/me/finance-card';
import { PathwayCard } from '@/components/me/pathway-card';
import { TasksCard } from '@/components/me/tasks-card';
import { computeEngagement } from '@/lib/education/engagement';
import type { HistoryEvent } from '@/lib/education/history';
import { useCurrentMemberId } from '@/lib/me/current-member';
import { partitionMeetings } from '@/lib/meetings/meetings';
import { buildRoles } from '@/lib/meetings/roles';
import {
  useGetActivityLogsQuery,
  useGetGuestsQuery,
  useGetMeetingRolesQuery,
  useGetMeetingsQuery,
  useGetMemberAhCounterEntriesQuery,
  useGetMemberEvaluationsQuery,
  useGetMemberHistoryQuery,
  useGetMemberQuery,
  useGetMemberStatsQuery,
  useGetMembersQuery,
  useGetMemberTimerEntriesQuery,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppSelector } from '@/store/hooks';
import {
  selectActiveContextKey,
  selectSessionMemberships,
  selectSessionUser,
} from '@/store/session-slice';

import { ClubPulseCard } from './club-pulse-card';
import { GreetingHeader } from './greeting-header';
import { LastSpeechCard } from './last-speech-card';
import { LineupCard } from './lineup-card';
import { NextMeetingCard } from './next-meeting-card';
import { RecentActivityCard } from './recent-activity-card';

function isSpeechGiven(
  event: HistoryEvent,
): event is Extract<HistoryEvent, { type: 'speech-given' }> {
  return event.type === 'speech-given';
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" aria-hidden>
      <div className="h-9 w-56 animate-pulse rounded bg-fill-strong" />
      <div className="h-44 animate-pulse rounded-2xl bg-fill-strong" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="h-40 animate-pulse rounded-xl border border-line bg-fill" />
          <div className="h-40 animate-pulse rounded-xl border border-line bg-fill" />
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
            <div key={index} className="h-32 animate-pulse rounded-xl border border-line bg-fill" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardContent({ memberId }: { memberId: string }) {
  const sessionUser = useAppSelector(selectSessionUser);
  const memberships = useAppSelector(selectSessionMemberships);
  const contextKey = useAppSelector(selectActiveContextKey);
  const clubId = contextKey?.startsWith('club:') ? contextKey.slice('club:'.length) : undefined;
  const clubName = memberships.find((m) => m.clubId === clubId)?.clubName;

  const { data: member } = useGetMemberQuery(memberId);
  const { data: stats } = useGetMemberStatsQuery(memberId);
  const { data: history } = useGetMemberHistoryQuery(memberId);
  const { data: meetings } = useGetMeetingsQuery();
  const { data: members } = useGetMembersQuery();
  const { data: evaluations } = useGetMemberEvaluationsQuery(memberId);
  const { data: timerEntries } = useGetMemberTimerEntriesQuery(memberId);
  const { data: ahCounterEntries } = useGetMemberAhCounterEntriesQuery(memberId);
  const { data: guests } = useGetGuestsQuery();
  /* Only the latest handful render — no need to page the whole log. */
  const { data: activityLogs } = useGetActivityLogsQuery({ limit: 20 });

  const now = new Date();
  const nextMeeting = meetings ? partitionMeetings(meetings, now.getTime()).current : null;
  const { data: nextMeetingRoles } = useGetMeetingRolesQuery(nextMeeting?.id ?? skipToken);

  if (!member || !stats || !history || !meetings) return <DashboardSkeleton />;

  const membersById = new Map((members ?? []).map((entry) => [entry.id, entry]));
  const guestsById = new Map((guests ?? []).map((entry) => [entry.id, entry]));

  const speeches = history.filter(isSpeechGiven);
  const latestSpeech = speeches[0] ?? null;
  const latestEvaluation = latestSpeech
    ? evaluations?.find((entry) => entry.speechEventId === latestSpeech.id)
    : undefined;
  const latestTimerEntry = latestSpeech
    ? timerEntries?.find((entry) => entry.speechEventId === latestSpeech.id)
    : undefined;
  const latestAhCounterEntry = latestSpeech
    ? ahCounterEntries?.find((entry) => entry.speechEventId === latestSpeech.id)
    : undefined;
  const evaluator = latestEvaluation ? membersById.get(latestEvaluation.evaluatorId) : undefined;

  const engagement = computeEngagement(stats, meetings, now);
  const { past, upcoming } = partitionMeetings(meetings, now.getTime());
  const activeMembers = (members ?? []).filter((entry) => entry.status === 'active').length;

  const myRole =
    nextMeeting && nextMeetingRoles
      ? (() => {
          const row = nextMeetingRoles.find((entry) => entry.membershipId === memberId);
          if (!row) return null;
          return buildRoles(nextMeeting).find((role) => role.key === row.roleKey)?.label ?? null;
        })()
      : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <GreetingHeader
        firstName={sessionUser?.firstName ?? member.firstName}
        clubName={clubName}
        now={now}
      />

      <NextMeetingCard meeting={nextMeeting} myRole={myRole} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <PathwayCard member={member} stats={stats} history={history} />
            <LastSpeechCard
              speech={latestSpeech}
              evaluation={latestEvaluation}
              timerEntry={latestTimerEntry}
              ahCounterEntry={latestAhCounterEntry}
              evaluator={evaluator}
            />
          </div>

          <LineupCard
            meeting={nextMeeting}
            roleAssignments={nextMeetingRoles ?? []}
            membersById={membersById}
            guestsById={guestsById}
            currentMemberId={memberId}
          />
        </div>

        <div className="flex flex-col gap-4">
          <ClubStandingCard stats={stats} engagement={engagement} />
          <TasksCard memberId={memberId} />
          <ClubPulseCard
            activeMembers={activeMembers}
            meetingsHeld={past.length}
            upcomingMeetings={upcoming.length}
          />
          <RecentActivityCard logs={activityLogs?.items ?? []} membersById={membersById} />
          <FinanceCard memberId={memberId} />
        </div>
      </div>
    </div>
  );
}

/** The club dashboard — the `/` route every member lands on. Blends the
 * club-wide picture (next meeting, who's running it, headline numbers) with
 * this member's own standing (pathway, last speech, tasks) on one screen,
 * the way the physical noticeboard by the club's front door used to. */
export function DashboardScreen() {
  const memberId = useCurrentMemberId();
  const { isError, error } = useGetMemberQuery(memberId ?? skipToken);

  if (!memberId) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <p className="text-sm text-ink">Switch to a club context to view the dashboard.</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <WarningCircle size={18} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">Could not load your dashboard</p>
        <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  return <DashboardContent memberId={memberId} />;
}
