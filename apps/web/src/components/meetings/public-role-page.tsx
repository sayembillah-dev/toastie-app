'use client';

import { ArrowsCounterClockwise, Warning } from '@phosphor-icons/react/dist/ssr';
import { Spin } from 'antd';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useSyncExternalStore } from 'react';
import { RoleIdentityGate } from '@/components/meetings/role-identity-gate';
import { AhCounterView } from '@/components/meetings/tabs/ah-counter-tab';
import { GrammarianView } from '@/components/meetings/tabs/grammarian-tab';
import { TimerView } from '@/components/meetings/tabs/timer-tab';
import {
  clearRoleIdentity,
  parseRoleIdentity,
  type RoleHolderIdentity,
  readRoleIdentityRaw,
  subscribeToRoleIdentity,
  writeRoleIdentity,
} from '@/lib/meetings/role-identity';
import type { RoleKind } from '@/lib/meetings/role-state';
import { useGetPublicMeetingQuery, useGetPublicRoleAssignmentQuery } from '@/store/api';

const MEETING_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const ROLE_LABELS: Record<RoleKind, string> = {
  'ah-counter': 'Ah Counter',
  timer: 'Timer',
  grammarian: 'Grammarian',
};

interface PublicRolePageProps {
  kind: RoleKind;
}

/** Public page for shared role modules. Fetches the meeting and the role's
 * assigned-holder name via the public share endpoints (auth-free,
 * token-gated), then hands off to the same interactive view the authed tab
 * uses. */
export function PublicRolePage({ kind }: PublicRolePageProps) {
  const params = useParams<{ meetingId: string }>();
  const search = useSearchParams();
  const meetingId = params?.meetingId ?? '';
  const token = search?.get('t') ?? '';
  const roleLabel = ROLE_LABELS[kind];

  const { data: meeting, isLoading: meetingLoading } = useGetPublicMeetingQuery(
    { meetingId, token },
    { skip: !meetingId || !token },
  );
  const { data: roleAssignment, isLoading: roleLoading } = useGetPublicRoleAssignmentQuery(
    { meetingId, role: kind, token },
    { skip: !meetingId || !token },
  );
  const assignedHolderName = roleAssignment?.name || undefined;

  const meetingLabel = meeting
    ? `Meeting #${meeting.meetingNumber} · ${MEETING_DATE_FMT.format(new Date(meeting.dateTime))}`
    : '';
  const clubName = meeting?.clubName ?? '';

  const identityRaw = useSyncExternalStore(
    useCallback((notify) => subscribeToRoleIdentity(kind, meetingId, notify), [kind, meetingId]),
    () => readRoleIdentityRaw(kind, meetingId),
    () => null,
  );
  const identity = parseRoleIdentity(identityRaw);

  const isLoading = meetingLoading || roleLoading;

  function handleConfirmed(next: Omit<RoleHolderIdentity, 'confirmedAt'>) {
    writeRoleIdentity(kind, meetingId, next);
  }

  function handleSwitchIdentity() {
    clearRoleIdentity(kind, meetingId);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spin size="large" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center px-4 py-10">
        <section className="w-full rounded-2xl border border-line bg-sidebar p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill text-ink-soft">
            <Warning size={22} />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-ink">
            We couldn&apos;t find this meeting
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            The link may be out of date. Please ask the meeting organiser for a fresh link.
          </p>
        </section>
      </div>
    );
  }

  if (!identity) {
    return (
      <RoleIdentityGate
        clubName={clubName}
        meetingLabel={meetingLabel}
        roleLabel={roleLabel}
        assignedHolderName={assignedHolderName}
        onConfirmed={handleConfirmed}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-sidebar">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-1 px-4 py-4 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            {roleLabel} · {clubName}
          </p>
          <h1 className="text-lg font-semibold text-ink">{meetingLabel}</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-sidebar px-4 py-2.5">
          <p className="text-[12px] text-ink-soft">
            Signed in as <span className="font-semibold text-ink">{identity.name}</span>
            {identity.isAssignedHolder ? (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                Assigned {roleLabel.toLowerCase()}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={handleSwitchIdentity}
            className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
          >
            <ArrowsCounterClockwise size={12} weight="bold" />
            Not you?
          </button>
        </div>

        {kind === 'ah-counter' ? <AhCounterView meetingId={meetingId} showShare={false} /> : null}
        {kind === 'timer' ? <TimerView meetingId={meetingId} showShare={false} /> : null}
        {kind === 'grammarian' ? <GrammarianView meetingId={meetingId} showShare={false} /> : null}
      </div>
    </div>
  );
}
