'use client';

import {
  AddressBook,
  Buildings,
  CalendarBlank,
  ClockCounterClockwise,
  Envelope,
  HandCoins,
  ShieldCheck,
  Users,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { Skeleton } from 'antd';
import { useMemo, useSyncExternalStore } from 'react';
import { ClubCodePanel } from '@/components/club-admin/club-code-panel';
import { StatTile } from '@/components/finance/stat-tile';
import { ORG_GRID_CLASSES, OrgCard } from '@/components/org/org-card';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { getInitials, getPrimaryRole } from '@/lib/education/members';
import { CURRENT_DUES_PERIOD_ID, getDuesPeriod, summariseDues } from '@/lib/finance/dues';
import { formatMoney } from '@/lib/finance/money';
import { partitionMeetings } from '@/lib/meetings/meetings';
import {
  useGetActivityLogsQuery,
  useGetInvitesQuery,
  useGetMeetingsQuery,
  useGetMembersQuery,
  useListDuesRecordsQuery,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/* Same client-clock trick used across the app (see `meetings-tabs.tsx`) so
 * "next meeting" partitioning stays deterministic through hydration. */
function subscribeNever(): () => void {
  return () => {};
}
let cachedClientNow: number | null = null;
function readClientNow(): number {
  if (cachedClientNow === null) cachedClientNow = Date.now();
  return cachedClientNow;
}
function readServerNow(): null {
  return null;
}
function useClientNow(): number | null {
  return useSyncExternalStore(subscribeNever, readClientNow, readServerNow);
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** The Club Admin landing page — a read-only roll-up of the roster, invites,
 * dues and activity the other three tabs (Members, Permissions, Audit Trail)
 * already own. Nothing here has its own endpoint; every figure is derived
 * from the same queries those tabs fetch, so this can never drift out of
 * sync with them. */
export function OverviewTab() {
  const now = useClientNow();
  const membersQuery = useGetMembersQuery({});
  const invitesQuery = useGetInvitesQuery();
  const activityQuery = useGetActivityLogsQuery();
  const duesQuery = useListDuesRecordsQuery(CURRENT_DUES_PERIOD_ID);
  const meetingsQuery = useGetMeetingsQuery();

  const isLoading =
    membersQuery.isLoading ||
    invitesQuery.isLoading ||
    activityQuery.isLoading ||
    duesQuery.isLoading ||
    meetingsQuery.isLoading ||
    now === null;
  const isError =
    membersQuery.isError ||
    invitesQuery.isError ||
    activityQuery.isError ||
    duesQuery.isError ||
    meetingsQuery.isError;
  const error =
    membersQuery.error ??
    invitesQuery.error ??
    activityQuery.error ??
    duesQuery.error ??
    meetingsQuery.error;

  const derived = useMemo(() => {
    const members = membersQuery.data ?? [];
    const invites = invitesQuery.data ?? [];
    const activity = activityQuery.data ?? [];
    const duesRecords = duesQuery.data ?? [];
    const meetings = meetingsQuery.data ?? [];

    const officers = members.filter((member) => member.roles.some((role) => role !== 'Member'));
    const pendingInvites = invites.filter((invite) => invite.status === 'pending');
    const duesSummary = summariseDues(duesRecords);
    const duesPeriod = getDuesPeriod(CURRENT_DUES_PERIOD_ID);

    const recentActivity = [...activity]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 5);

    const membersById = new Map(members.map((member) => [member.id, member]));

    const nextMeeting = now === null ? null : partitionMeetings(meetings, now).current;

    return {
      activeMembers: members.length,
      officers: officers.length,
      pendingInvites: pendingInvites.length,
      duesSummary,
      duesPeriod,
      recentActivity,
      membersById,
      nextMeeting,
    };
  }, [
    membersQuery.data,
    invitesQuery.data,
    activityQuery.data,
    duesQuery.data,
    meetingsQuery.data,
    now,
  ]);

  if (isError) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <WarningCircle size={18} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">Could not load the Club Admin overview</p>
        <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
            <div key={index} className="rounded-xl border border-line bg-canvas p-4">
              <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const {
    activeMembers,
    officers,
    pendingInvites,
    duesSummary,
    duesPeriod,
    recentActivity,
    membersById,
    nextMeeting,
  } = derived;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ClubCodePanel />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Users size={16} />} label="Active members" value={String(activeMembers)} />
        <StatTile
          icon={<ShieldCheck size={16} />}
          label="Officers"
          value={String(officers)}
          hint="Holding a role beyond plain Member"
        />
        <StatTile
          icon={<Envelope size={16} />}
          label="Pending invites"
          value={String(pendingInvites)}
          tone={pendingInvites > 0 ? 'warning' : 'default'}
        />
        <StatTile
          icon={<HandCoins size={16} />}
          label="Outstanding dues"
          value={formatMoney(duesSummary.outstandingMinor)}
          tone={duesSummary.outstandingMinor > 0 ? 'warning' : 'default'}
          hint={duesPeriod?.label}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Manage</h2>
        <div className={ORG_GRID_CLASSES}>
          <OrgCard
            Icon={AddressBook}
            title="Members"
            subtitle={`${activeMembers} active on the roster`}
            href="/club-admin/members"
          />
          <OrgCard
            Icon={ShieldCheck}
            title="Permissions"
            subtitle="Roles and per-module overrides"
            href="/club-admin/permissions"
          />
          <OrgCard
            Icon={ClockCounterClockwise}
            title="Audit Trail"
            subtitle="Every action, who did it, when"
            href="/club-admin/audit-trail"
          />
          <OrgCard
            Icon={Buildings}
            title="Club Profile"
            subtitle="Name, venue, motto, socials"
            href="/club-admin/profile"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Next meeting</h2>
          {nextMeeting ? (
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill text-ink-soft"
              >
                <CalendarBlank size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  Meeting {nextMeeting.meetingNumber} · {nextMeeting.theme}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {DATE_FMT.format(new Date(nextMeeting.dateTime))} ·{' '}
                  {TIME_FMT.format(new Date(nextMeeting.dateTime))}
                  {nextMeeting.status === 'draft' ? ' · Draft' : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">No upcoming meeting scheduled.</p>
          )}
        </div>

        <div className="rounded-xl border border-line bg-canvas p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Recent activity</h2>
            <a href="/club-admin/audit-trail" className="text-xs text-ink-muted hover:text-ink">
              View all
            </a>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-ink-muted">Nothing logged yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {recentActivity.map((log) => {
                const actor = membersById.get(log.actorMemberId);
                return (
                  <li key={log.id} className="flex items-start gap-2.5 text-sm">
                    <PersonAvatar
                      src={actor?.avatarUrl}
                      initials={actor ? getInitials(actor) : '?'}
                      sizeClass="size-6"
                      textClass="text-[10px]"
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-ink">{log.summary}</p>
                      <p className="text-xs text-ink-muted">
                        {actor ? `${actor.firstName} ${actor.lastName}` : 'A member'}
                        {actor ? ` · ${getPrimaryRole(actor)}` : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
