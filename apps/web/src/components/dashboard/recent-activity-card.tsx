import {
  AddressBook,
  BookOpen,
  ClipboardText,
  ClockCounterClockwise,
  Globe,
  GraduationCap,
  ListChecks,
  Users,
  Wallet,
} from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

import type { ActivityCategory, ActivityLog } from '@/lib/activity/activity-log';
import type { Member } from '@/lib/education/members';

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

const CATEGORY_ICON: Record<ActivityCategory, IconComponent> = {
  meeting: Users,
  education: GraduationCap,
  finance: Wallet,
  inventory: ClipboardText,
  people: AddressBook,
  library: BookOpen,
  task: ListChecks,
  org: Globe,
};

/** The number of rows shown before the "see all" link — enough to feel alive
 * without turning the dashboard into the full Activity Logs page. */
const VISIBLE_COUNT = 5;

interface RecentActivityCardProps {
  logs: ActivityLog[];
  membersById: Map<string, Member>;
}

/** A trimmed, read-only slice of the club-wide activity feed — "what's been
 * happening" for members who never open the full Activity Logs page. */
export function RecentActivityCard({ logs, membersById }: RecentActivityCardProps) {
  const recent = logs.slice(0, VISIBLE_COUNT);

  return (
    <article className="rounded-xl border border-line bg-canvas p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <ClockCounterClockwise size={15} weight="bold" className="text-ink-muted" />
          Recent activity
        </h2>
        <Link
          href="/activity-logs"
          className="text-xs font-medium text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          View all
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="mt-4 text-xs text-ink-muted">Nothing logged yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {recent.map((log) => {
            const actor = membersById.get(log.actorMemberId);
            const Icon = CATEGORY_ICON[log.category];
            return (
              <li key={log.id} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-fill text-ink-soft"
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug text-ink">{log.summary}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {actor ? `${actor.firstName} ${actor.lastName}` : 'A member'} ·{' '}
                    {TIME_FMT.format(new Date(log.createdAt))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
