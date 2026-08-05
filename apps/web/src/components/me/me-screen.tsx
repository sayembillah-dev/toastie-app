'use client';

import { WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { computeEngagement } from '@/lib/education/engagement';
import type { HistoryEvent } from '@/lib/education/history';
import { getNextProject } from '@/lib/education/pathways';
import { CURRENT_MEMBER_ID } from '@/lib/me/current-member';
import {
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

import { ClubStandingCard } from './club-standing-card';
import { FinanceCard } from './finance-card';
import { PathwayCard } from './pathway-card';
import { ProfileHero } from './profile-hero';
import { RequestSpeechSlotModal } from './request-speech-slot-modal';
import { SpeechSlotCard } from './speech-slot-card';
import { SpeechesFeed } from './speeches-feed';
import { TasksCard } from './tasks-card';

function MeSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" aria-hidden>
      <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
        <div className="h-28 animate-pulse bg-fill-strong" />
        <div className="flex flex-col gap-3 px-6 pb-5 pt-13">
          <div className="h-6 w-56 animate-pulse rounded bg-fill-strong" />
          <div className="h-4 w-40 animate-pulse rounded bg-fill-strong" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="h-44 animate-pulse rounded-xl border border-line bg-fill" />
          <div className="h-32 animate-pulse rounded-xl border border-line bg-fill" />
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

function isSpeechGiven(
  event: HistoryEvent,
): event is Extract<HistoryEvent, { type: 'speech-given' }> {
  return event.type === 'speech-given';
}

function MeContent() {
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const { data: member } = useGetMemberQuery(CURRENT_MEMBER_ID);
  const { data: stats } = useGetMemberStatsQuery(CURRENT_MEMBER_ID);
  const { data: history } = useGetMemberHistoryQuery(CURRENT_MEMBER_ID);
  const { data: meetings } = useGetMeetingsQuery();
  const { data: members } = useGetMembersQuery();
  const { data: evaluations } = useGetMemberEvaluationsQuery(CURRENT_MEMBER_ID);
  const { data: timerEntries } = useGetMemberTimerEntriesQuery(CURRENT_MEMBER_ID);
  const { data: ahCounterEntries } = useGetMemberAhCounterEntriesQuery(CURRENT_MEMBER_ID);

  if (!member || !stats || !history || !meetings) return <MeSkeleton />;

  const engagement = computeEngagement(stats, meetings, new Date());
  const speeches = history.filter(isSpeechGiven);
  const membersById = new Map((members ?? []).map((entry) => [entry.id, entry]));

  const completedProjectNames = history
    .filter(
      (event): event is Extract<HistoryEvent, { type: 'project-completed' }> =>
        event.type === 'project-completed',
    )
    .map((event) => event.projectName);
  const nextProjectName =
    member.pathway && member.level
      ? getNextProject(
          member.pathway,
          member.level,
          completedProjectNames,
          stats.currentProject?.name,
        )?.name
      : undefined;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <ProfileHero
        member={member}
        joinedAt={stats.joinedAt}
        meetingsAttended={engagement.meetingsAttended}
        onRequestSlot={() => setRequestModalOpen(true)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <PathwayCard member={member} stats={stats} history={history} />
          <SpeechesFeed
            speeches={speeches}
            evaluations={evaluations ?? []}
            timerEntries={timerEntries ?? []}
            ahCounterEntries={ahCounterEntries ?? []}
            membersById={membersById}
          />
        </div>

        <div className="flex flex-col gap-4">
          <ClubStandingCard stats={stats} engagement={engagement} />
          <SpeechSlotCard onNewRequest={() => setRequestModalOpen(true)} />
          <TasksCard />
          <FinanceCard />
        </div>
      </div>

      <RequestSpeechSlotModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        defaultProjectName={nextProjectName}
      />
    </div>
  );
}

/** Top-level screen for the Me page. There is no sign-in flow yet, so this
 * always renders `CURRENT_MEMBER_ID`'s data — every child reads that same
 * constant rather than taking a memberId prop, so swapping in a real session
 * later is a one-file change. */
export function MeScreen() {
  const { isError, error } = useGetMemberQuery(CURRENT_MEMBER_ID);

  if (isError) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <WarningCircle size={18} weight="bold" />
          </span>
          <p className="text-sm font-medium text-ink">Could not load your profile</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <MeContent />
    </AppShell>
  );
}
