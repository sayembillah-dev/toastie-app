'use client';

import { DotsThree, Heartbeat, Microphone, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

import { computeEngagement } from '@/lib/education/engagement';
import type { Member } from '@/lib/education/members';
import { formatRoles, getInitials } from '@/lib/education/members';
import { useGetMeetingsQuery, useGetMemberStatsQuery } from '@/store/api';

export type MemberCardVariant = 'education' | 'engagement';

interface MemberCardProps {
  member: Member;
  /** Controls which two stats sit above the name. Education tracks Pathways
   * progress (level + pathway); engagement tracks roster health (speeches +
   * health badge). Defaults to `education` so the Education directory is
   * unchanged. */
  variant?: MemberCardVariant;
}

/** Paired pastel background + darker foreground for the initials circle. Each
 * entry stays contrast-safe on its own so the initials read cleanly. */
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

/** djb2-ish string hash. Stable across server and client so hydration matches
 * and the same member always lands on the same palette entry. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function EducationStats({ member }: { member: Member }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">Level</div>
        <div
          className={`mt-0.5 text-lg font-semibold leading-none ${
            member.level ? 'text-ink' : 'text-ink-muted'
          }`}
        >
          {member.level ?? '—'}
        </div>
      </div>
      <div className="min-w-0 text-right">
        <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Pathway
        </div>
        <div
          className={`mt-0.5 text-xs font-semibold leading-snug ${
            member.pathway ? 'text-ink' : 'italic text-ink-muted'
          }`}
        >
          {member.pathway ?? 'Not started'}
        </div>
      </div>
    </div>
  );
}

function EngagementStats({ member }: { member: Member }) {
  /* Health depends on both attendance and activity, so meetings feed the
   * calculation alongside the member's own stats. RTK Query dedupes the
   * meetings request across every card in the grid. */
  const { data: stats, isLoading: statsLoading } = useGetMemberStatsQuery(member.id);
  const { data: meetings, isLoading: meetingsLoading } = useGetMeetingsQuery();

  const engagement = stats && meetings ? computeEngagement(stats, meetings, new Date()) : null;
  const healthy = engagement?.health === 'healthy';
  const loading = statsLoading || meetingsLoading;

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Speeches
        </div>
        <div className="mt-0.5 flex items-baseline gap-1 text-lg font-semibold leading-none text-ink">
          {loading || !stats ? (
            <span
              className="inline-block h-4 w-6 animate-pulse rounded bg-fill-strong"
              aria-hidden
            />
          ) : (
            <>
              <Microphone size={14} weight="bold" className="text-ink-muted" aria-hidden />
              <span>{stats.speechesGiven}</span>
            </>
          )}
        </div>
      </div>
      <div className="min-w-0 text-right">
        <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">Health</div>
        <div className="mt-0.5 flex justify-end">
          {!engagement ? (
            <span
              className="inline-block h-5 w-16 animate-pulse rounded-full bg-fill-strong"
              aria-hidden
            />
          ) : (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                healthy ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {healthy ? (
                <Heartbeat size={11} weight="bold" aria-hidden />
              ) : (
                <WarningCircle size={11} weight="bold" aria-hidden />
              )}
              {healthy ? 'Healthy' : 'At Risk'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Directory card modelled on the "Profile" reference: a slate banner, a
 * circular initials badge that straddles the banner/body seam, then a stat
 * row for Level/Pathway, name, and officer role. */
export function MemberCard({ member, variant = 'education' }: MemberCardProps) {
  const fullName = `${member.firstName} ${member.lastName}`;
  const initials = getInitials(member);
  const swatch = AVATAR_PALETTE[hashString(member.id) % AVATAR_PALETTE.length];
  const href =
    variant === 'engagement' ? `/people/members/${member.id}` : `/education/${member.id}`;

  return (
    <Link
      href={href}
      aria-label={`Open profile for ${fullName}`}
      className="group relative block overflow-hidden rounded-xl border border-line bg-canvas transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
    >
      <div className="h-16 bg-slate-700 px-3 pt-2.5">
        <div className="flex items-start justify-end text-white">
          <DotsThree size={16} weight="bold" aria-hidden />
        </div>
      </div>

      {/* Avatar overlaps the banner/body seam. ring-4 with the canvas colour
       * cuts a clean gap so the circle sits above both surfaces. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-10 flex size-12 -translate-x-1/2 items-center justify-center rounded-full ring-4 ring-canvas transition-transform duration-300 ease-out group-hover:scale-110"
        style={{ backgroundColor: swatch.bg, color: swatch.fg }}
      >
        <span className="text-sm font-semibold tracking-wide">{initials}</span>
      </div>

      <div className="px-3.5 pb-4 pt-8">
        {variant === 'engagement' ? (
          <EngagementStats member={member} />
        ) : (
          <EducationStats member={member} />
        )}

        <div className="mt-3 text-center">
          <h3 className="text-sm font-semibold text-ink">{fullName}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{formatRoles(member)}</p>
        </div>
      </div>
    </Link>
  );
}
