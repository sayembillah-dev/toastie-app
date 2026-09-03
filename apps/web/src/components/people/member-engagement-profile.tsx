'use client';

import {
  ArrowLeft,
  Calendar,
  ChartLineUp,
  Compass,
  Heartbeat,
  Microphone,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { skipToken } from '@reduxjs/toolkit/query';
import { Button } from 'antd';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { AccessGate } from '@/components/permissions/access-gate';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { computeEngagement } from '@/lib/education/engagement';
import type { Member } from '@/lib/education/members';
import { formatRoles, getInitials } from '@/lib/education/members';
import { useGetMeetingsQuery, useGetMemberQuery, useGetMemberStatsQuery } from '@/store/api';
import { getApiErrorMessage, isNotFoundError } from '@/store/api-error';

/** Shared palette with the directory card so the avatar keeps the same identity
 * across list, card, and detail views. */
const AVATAR_PALETTE = [
  { bg: '#FFE4E6', fg: '#881337' },
  { bg: '#FEF3C7', fg: '#78350F' },
  { bg: '#ECFCCB', fg: '#365314' },
  { bg: '#D1FAE5', fg: '#064E3B' },
  { bg: '#CFFAFE', fg: '#164E63' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#E0E7FF', fg: '#312E81' },
  { bg: '#EDE9FE', fg: '#4C1D95' },
  { bg: '#FAE8FF', fg: '#701A75' },
  { bg: '#FCE7F3', fg: '#831843' },
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface MetricCardProps {
  label: string;
  Icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'bold'; className?: string }>;
  tint: { bg: string; fg: string };
  children: React.ReactNode;
}

/** One tile in the metrics grid. Icon + tint carry the shape at a glance; the
 * body is free-form so the same tile can hold a big number, a ratio, or a
 * project name. */
function MetricCard({ label, Icon, tint, children }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-md"
          style={{ backgroundColor: tint.bg, color: tint.fg }}
        >
          <Icon size={13} weight="bold" />
        </span>
        {label}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill-strong">
      <div
        className="h-full rounded-full bg-ink transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function ProfileHeader({
  member,
  health,
}: {
  member: Member;
  health: 'healthy' | 'at-risk' | null;
}) {
  const fullName = `${member.firstName} ${member.lastName}`;
  const initials = getInitials(member);
  const swatch = AVATAR_PALETTE[hashString(member.id) % AVATAR_PALETTE.length];
  const healthy = health === 'healthy';

  return (
    <header className="relative overflow-hidden rounded-2xl border border-line bg-canvas">
      <div aria-hidden className="h-24 bg-slate-700" />
      <div className="relative px-6 pb-5">
        <PersonAvatar
          src={member.avatarUrl}
          initials={initials}
          swatch={swatch}
          sizeClass="size-20"
          textClass="text-2xl tracking-wide"
          className="absolute -top-10 left-6 ring-4 ring-canvas"
        />
        <div className="flex flex-wrap items-end justify-between gap-4 pt-12">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">{fullName}</h1>
            <p className="mt-1 text-sm text-ink-soft">{formatRoles(member)}</p>
          </div>
          {health ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                healthy ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {healthy ? (
                <Heartbeat size={12} weight="bold" aria-hidden />
              ) : (
                <WarningCircle size={12} weight="bold" aria-hidden />
              )}
              {healthy ? 'Healthy' : 'At Risk'}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" aria-hidden>
      <div className="h-7 w-32 animate-pulse rounded bg-fill-strong" />
      <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
        <div className="h-24 animate-pulse bg-fill-strong" />
        <div className="flex flex-col gap-3 px-6 pb-5 pt-14">
          <div className="h-6 w-56 animate-pulse rounded bg-fill-strong" />
          <div className="h-4 w-24 animate-pulse rounded bg-fill-strong" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
            key={index}
            className="h-28 animate-pulse rounded-xl border border-line bg-fill"
          />
        ))}
      </div>
    </div>
  );
}

function ProfileContent({ member }: { member: Member }) {
  /* Both stats and the meeting roster feed the numbers below. Stats can only be
   * computed once the member exists (this branch owns that guarantee), so both
   * queries fire in parallel here rather than gated on each other. */
  const { data: stats } = useGetMemberStatsQuery(member.id);
  const { data: meetings } = useGetMeetingsQuery();

  if (!stats || !meetings) return <ProfileSkeleton />;

  const engagement = computeEngagement(stats, meetings, new Date());
  const activeAppearances = stats.speechesGiven + stats.rolesTaken;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <Link href="/people">
          <Button
            type="text"
            size="small"
            icon={<ArrowLeft size={14} className="text-ink-muted" />}
          >
            <span className="text-xs text-ink-soft">Back to People</span>
          </Button>
        </Link>
      </div>

      <ProfileHeader member={member} health={engagement.health} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Speeches given"
          Icon={Microphone}
          tint={{ bg: '#DBEAFE', fg: '#1E3A8A' }}
        >
          <div className="text-3xl font-semibold leading-none text-ink">{stats.speechesGiven}</div>
          <p className="mt-2 text-xs text-ink-muted">
            {stats.latestSpeech
              ? `Last: "${stats.latestSpeech.title}"`
              : 'No speeches recorded yet'}
          </p>
        </MetricCard>

        <MetricCard label="Attendance" Icon={Calendar} tint={{ bg: '#D1FAE5', fg: '#065F46' }}>
          <div className="flex items-baseline gap-1 text-ink">
            <span className="text-3xl font-semibold leading-none">
              {engagement.attendancePercent}
            </span>
            <span className="text-sm text-ink-soft">%</span>
          </div>
          <div className="mt-3">
            <ProgressBar percent={engagement.attendancePercent} />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {engagement.meetingsAttended} of {engagement.meetingsHeld} meetings since joining
          </p>
        </MetricCard>

        <MetricCard label="Current project" Icon={Compass} tint={{ bg: '#FEF3C7', fg: '#854D0E' }}>
          {stats.currentProject ? (
            <>
              <div className="truncate text-lg font-semibold leading-tight text-ink">
                {stats.currentProject.name}
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {stats.currentProject.pathway} · Level {stats.currentProject.level}
              </p>
            </>
          ) : member.pathway && member.level ? (
            <>
              <div className="text-lg font-semibold leading-tight text-ink">Between projects</div>
              <p className="mt-1 text-xs text-ink-soft">
                {member.pathway} · Level {member.level}
              </p>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold leading-tight text-ink-muted">Not started</div>
              <p className="mt-1 text-xs text-ink-muted">No pathway chosen yet</p>
            </>
          )}
        </MetricCard>

        <MetricCard label="Activity" Icon={ChartLineUp} tint={{ bg: '#EDE9FE', fg: '#4C1D95' }}>
          <div className="flex items-baseline gap-1 text-ink">
            <span className="text-3xl font-semibold leading-none">
              {engagement.activityPercent}
            </span>
            <span className="text-sm text-ink-soft">%</span>
          </div>
          <div className="mt-3">
            <ProgressBar percent={engagement.activityPercent} />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {activeAppearances} speech or role turns across {engagement.meetingsAttended} attended
          </p>
        </MetricCard>
      </section>
    </div>
  );
}

/** Top-level client screen for a member's engagement view — separate from the
 * Education profile because People asks a different question of the same
 * record: "how engaged is this person?" rather than "how far along the
 * pathway?" */
export function MemberEngagementScreen() {
  const params = useParams<{ memberId: string }>();
  const memberId = params?.memberId;
  const { data: member, isError, error } = useGetMemberQuery(memberId ?? skipToken);

  if (isError) {
    if (isNotFoundError(error)) notFound();

    return (
      <>
        <PageBreadcrumb label="Member" />
        <div className="mx-auto max-w-md rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <WarningCircle size={18} weight="bold" />
          </span>
          <p className="text-sm font-medium text-ink">Could not load this member</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
        </div>
      </>
    );
  }

  if (!member) {
    /* No name yet — hand the shell a static label so the header never falls
     * back to title-casing the raw id from the URL. */
    return (
      <>
        <PageBreadcrumb label="Member" />
        <ProfileSkeleton />
      </>
    );
  }

  return (
    <>
      <PageBreadcrumb label={`${member.firstName} ${member.lastName}`} />
      <AccessGate resource="member">
        <ProfileContent member={member} />
      </AccessGate>
    </>
  );
}
