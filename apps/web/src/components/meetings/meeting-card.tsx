'use client';

import { CalendarBlank, Circle, Clock, Copy, PenNib } from '@phosphor-icons/react/dist/ssr';
import { App, Button } from 'antd';
import Link from 'next/link';

import { buildMeetingCaption } from '@/lib/meetings/caption';
import type { Meeting, MeetingStatus } from '@/lib/meetings/meetings';
import { toAssigneeMap } from '@/lib/meetings/role-assignments';
import {
  useLazyGetClubProfileQuery,
  useLazyGetGuestsQuery,
  useLazyGetMeetingRolesQuery,
  useLazyGetMembersQuery,
} from '@/store/api';
import { useAppSelector } from '@/store/hooks';
import { selectSessionMemberships } from '@/store/session-slice';

interface MeetingCardProps {
  meeting: Meeting;
  /** `featured` is the Current-tab hero: bigger type, gradient banner, more
   * breathing room. `default` is the grid tile used by Upcoming and Past. */
  variant?: 'default' | 'featured';
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

interface StatusStyle {
  label: string;
  pillBg: string;
  pillFg: string;
  dotFg: string;
  Icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'bold' | 'fill' }>;
}

const STATUS_STYLES: Record<MeetingStatus, StatusStyle> = {
  draft: {
    label: 'Draft',
    pillBg: '#FEF3C7',
    pillFg: '#78350F',
    dotFg: '#D97706',
    Icon: PenNib,
  },
  published: {
    label: 'Published',
    pillBg: '#D1FAE5',
    pillFg: '#065F46',
    dotFg: '#059669',
    Icon: Circle,
  },
};

function StatusBadge({ status }: { status: MeetingStatus }) {
  const style = STATUS_STYLES[status];
  const { Icon } = style;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: style.pillBg, color: style.pillFg }}
    >
      <Icon size={10} weight="fill" />
      {style.label}
    </span>
  );
}

/** Modern meeting tile — a subtle banner up top carries the meeting number and
 * status flag, and the body pairs the date/time metadata with the theme. */
export function MeetingCard({ meeting, variant = 'default' }: MeetingCardProps) {
  const when = new Date(meeting.dateTime);
  const isFeatured = variant === 'featured';

  const { message } = App.useApp();
  const memberships = useAppSelector(selectSessionMemberships);
  const [fetchRoles] = useLazyGetMeetingRolesQuery();
  const [fetchMembers] = useLazyGetMembersQuery();
  const [fetchGuests] = useLazyGetGuestsQuery();
  const [fetchClubProfile] = useLazyGetClubProfileQuery();

  /* Role/member/guest/club-profile data is only needed once someone actually
   * wants the caption, so it's fetched lazily on click rather than on every
   * card's mount — a grid of dozens of past meetings would otherwise fire a
   * roles request per tile for a feature most of them will never use. */
  async function handleCopyCaption() {
    try {
      const [rolesResult, membersResult, guestsResult, clubProfileResult] = await Promise.all([
        fetchRoles(meeting.id),
        fetchMembers(),
        fetchGuests(),
        fetchClubProfile(),
      ]);
      const assignments = toAssigneeMap(rolesResult.data ?? [], guestsResult.data ?? []);
      const members = membersResult.data ?? [];

      function nameOf(roleKey: string): string {
        const assignee = assignments[roleKey];
        if (!assignee) return '';
        if (assignee.kind === 'guest') return assignee.name;
        const member = members.find((m) => m.id === assignee.memberId);
        return member ? `${member.firstName} ${member.lastName}` : '';
      }

      const clubName = memberships.find((m) => m.clubId === meeting.clubId)?.clubName ?? '';
      const caption = buildMeetingCaption(
        meeting,
        {
          name: clubProfileResult.data?.name ?? clubName,
          venueAddress: clubProfileResult.data?.venueAddress ?? '',
          venueMapUrl: clubProfileResult.data?.venueMapUrl ?? '',
        },
        {
          generalEvaluator: nameOf('general-evaluator'),
          tableTopicsMaster: nameOf('table-topic-master'),
          toastmaster: nameOf('toastmaster'),
        },
      );

      await navigator.clipboard.writeText(caption);
      message.success('Caption copied');
    } catch {
      message.error('Could not copy caption');
    }
  }

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      aria-label={`Meeting #${meeting.meetingNumber} — ${meeting.theme}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-canvas text-left no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
        isFeatured ? 'shadow-sm' : ''
      }`}
    >
      {/* Accent banner: keeps the featured card visually louder without any
       * layout changes — same DOM, tuned intensity. */}
      <div
        className={`relative flex items-start justify-between px-4 pt-4 pb-3 ${
          isFeatured
            ? 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-white'
            : 'bg-slate-700 text-white'
        }`}
      >
        <div className="flex flex-col">
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest ${
              isFeatured ? 'text-slate-300' : 'text-slate-300'
            }`}
          >
            Meeting
          </span>
          <span
            className={`mt-0.5 font-semibold leading-none ${isFeatured ? 'text-3xl' : 'text-xl'}`}
          >
            #{meeting.meetingNumber}
          </span>
        </div>
        <StatusBadge status={meeting.status} />
      </div>

      <div
        className={`flex flex-col gap-3 px-4 pt-4 pb-4 ${isFeatured ? 'sm:px-6 sm:pt-5 sm:pb-5' : ''}`}
      >
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            Theme
          </div>
          <h3
            className={`mt-1 font-semibold text-ink ${isFeatured ? 'text-lg sm:text-xl' : 'text-sm'}`}
          >
            {meeting.theme}
          </h3>
        </div>

        <div
          className={`mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-soft ${
            isFeatured ? 'text-sm' : 'text-xs'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlank size={isFeatured ? 16 : 14} weight="bold" className="text-ink-muted" />
            <time dateTime={meeting.dateTime}>{DATE_FMT.format(when)}</time>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={isFeatured ? 16 : 14} weight="bold" className="text-ink-muted" />
            <time dateTime={meeting.dateTime}>{TIME_FMT.format(when)}</time>
          </span>
        </div>

        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            size="small"
            icon={<Copy size={13} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleCopyCaption();
            }}
          >
            Copy caption
          </Button>
        </div>
      </div>
    </Link>
  );
}
