'use client';

import { CalendarCheck, CalendarDots, ClockCounterClockwise } from '@phosphor-icons/react/dist/ssr';
import { Tabs } from 'antd';
import { useMemo, useSyncExternalStore } from 'react';

import { MeetingCard } from '@/components/meetings/meeting-card';
import type { Meeting } from '@/lib/meetings/meetings';
import { partitionMeetings, SEED_MEETINGS } from '@/lib/meetings/meetings';

/* `useSyncExternalStore` compares snapshots with `Object.is` — a fresh
 * `Date.now()` each call would look like a new value every commit and loop
 * forever. Capture once at module scope so every render sees the same number,
 * which is exactly what we want: "the moment we became a client". */
let cachedClientNow: number | null = null;

function subscribeNever(): () => void {
  return () => {};
}
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

const GRID_CLASSES = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

/** Full date + weekday, used above the featured card so the hero line reads
 * naturally on its own. */
const HERO_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function daysUntil(target: string, now: number): number {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(target);
  startOfTarget.setHours(0, 0, 0, 0);
  const diff = startOfTarget.getTime() - startOfToday.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function untilLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

interface CurrentPanelProps {
  meeting: Meeting | null;
  now: number | null;
}

function CurrentPanel({ meeting, now }: CurrentPanelProps) {
  if (now === null) return <SkeletonHero />;
  if (!meeting) {
    return (
      <EmptyState
        title="No upcoming meeting"
        body="Once a meeting is scheduled it will appear here."
      />
    );
  }

  const days = daysUntil(meeting.dateTime, now);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 font-medium text-ink">
          <CalendarCheck size={14} weight="bold" />
          Next up · {untilLabel(days)}
        </span>
        <span className="text-ink-muted">{HERO_DATE_FMT.format(new Date(meeting.dateTime))}</span>
      </div>
      <MeetingCard meeting={meeting} variant="featured" />
    </div>
  );
}

interface MeetingsGridProps {
  meetings: Meeting[];
  emptyTitle: string;
  emptyBody: string;
}

function MeetingsGrid({ meetings, emptyTitle, emptyBody }: MeetingsGridProps) {
  if (meetings.length === 0) return <EmptyState title={emptyTitle} body={emptyBody} />;
  return (
    <div className={GRID_CLASSES}>
      {meetings.map((meeting) => (
        <MeetingCard key={meeting.id} meeting={meeting} />
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-xs text-ink-muted">{body}</p>
    </div>
  );
}

/* Kept the same width and rhythm as the featured card so hydration doesn't
 * shift the layout when the real data arrives. */
function SkeletonHero() {
  return (
    <div className="mx-auto max-w-2xl" aria-hidden>
      <div className="mb-4 h-6 w-40 animate-pulse rounded-full bg-fill" />
      <div className="h-56 animate-pulse rounded-2xl border border-line bg-fill" />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className={GRID_CLASSES} aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
        <div key={index} className="h-40 animate-pulse rounded-2xl border border-line bg-fill" />
      ))}
    </div>
  );
}

/* Counter chip on each tab label. Rendered alongside the icon so the active
 * tab still reads at a glance on narrow screens. */
function CountBadge({ count }: { count: number }) {
  return (
    <span className="ml-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-fill px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
      {count}
    </span>
  );
}

/** Meetings hub — three tabs sharing the same header and content padding.
 * Current features the next upcoming meeting; Upcoming lists everything ahead;
 * Past reverses time so the most recent recap comes first. */
export function MeetingsTabs() {
  /* `useClientNow` returns null on the server render and the real timestamp
   * once we're mounted — that keeps the initial HTML deterministic and lets us
   * defer the actual partition until the clock is trustworthy. */
  const now = useClientNow();

  const partitioned = useMemo(() => {
    if (now === null) {
      return { past: [] as Meeting[], current: null as Meeting | null, upcoming: [] as Meeting[] };
    }
    return partitionMeetings(SEED_MEETINGS, now);
  }, [now]);

  const { past, current, upcoming } = partitioned;
  const isReady = now !== null;

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-ink">Meetings</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every meeting on one timeline — see what&apos;s next, what&apos;s scheduled, and what the
          club has already shipped.
        </p>
      </header>

      <Tabs
        defaultActiveKey="current"
        size="middle"
        items={[
          {
            key: 'current',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck size={14} weight="bold" />
                Current
              </span>
            ),
            children: <CurrentPanel meeting={current} now={now} />,
          },
          {
            key: 'upcoming',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDots size={14} weight="bold" />
                Upcoming
                {isReady ? <CountBadge count={upcoming.length} /> : null}
              </span>
            ),
            children: isReady ? (
              <MeetingsGrid
                meetings={upcoming}
                emptyTitle="Nothing scheduled yet"
                emptyBody="Draft a meeting from the planner and it will appear here."
              />
            ) : (
              <SkeletonGrid />
            ),
          },
          {
            key: 'past',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <ClockCounterClockwise size={14} weight="bold" />
                Past
                {isReady ? <CountBadge count={past.length} /> : null}
              </span>
            ),
            children: isReady ? (
              <MeetingsGrid
                meetings={past}
                emptyTitle="No past meetings yet"
                emptyBody="Once a meeting finishes it will be archived here."
              />
            ) : (
              <SkeletonGrid />
            ),
          },
        ]}
      />
    </div>
  );
}
