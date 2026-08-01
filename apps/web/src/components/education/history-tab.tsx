'use client';

import {
  CheckCircle,
  Confetti,
  Flag,
  Microphone,
  MicrophoneStage,
  Rocket,
  Trophy,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { Fragment } from 'react';

import type { HistoryEvent, HistoryEventKind } from '@/lib/education/history';
import type { Member } from '@/lib/education/members';
import { useGetMemberHistoryQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface HistoryTabProps {
  member: Member;
}

/** Type-specific styling for the timeline node + category pill. Keeping this in
 * one place means adding an event kind is a one-file change. */
const EVENT_STYLES: Record<
  HistoryEventKind,
  {
    label: string;
    Icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'bold' | 'fill' }>;
    dotBg: string;
    dotFg: string;
    pillBg: string;
    pillFg: string;
  }
> = {
  joined: {
    label: 'Joined the club',
    Icon: Confetti,
    dotBg: '#FCE7F3',
    dotFg: '#9D174D',
    pillBg: '#FDF2F8',
    pillFg: '#9D174D',
  },
  'level-reached': {
    label: 'Level reached',
    Icon: Trophy,
    dotBg: '#FEF3C7',
    dotFg: '#854D0E',
    pillBg: '#FFFBEB',
    pillFg: '#854D0E',
  },
  'speech-given': {
    label: 'Speech given',
    Icon: Microphone,
    dotBg: '#DBEAFE',
    dotFg: '#1E3A8A',
    pillBg: '#EFF6FF',
    pillFg: '#1E3A8A',
  },
  'project-started': {
    label: 'Project started',
    Icon: Rocket,
    dotBg: '#EDE9FE',
    dotFg: '#5B21B6',
    pillBg: '#F5F3FF',
    pillFg: '#5B21B6',
  },
  'project-completed': {
    label: 'Project completed',
    Icon: CheckCircle,
    dotBg: '#D1FAE5',
    dotFg: '#065F46',
    pillBg: '#ECFDF5',
    pillFg: '#065F46',
  },
  'role-taken': {
    label: 'Meeting role',
    Icon: MicrophoneStage,
    dotBg: '#CFFAFE',
    dotFg: '#155E75',
    pillBg: '#ECFEFF',
    pillFg: '#155E75',
  },
};

function formatFullDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMonthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

function getMonthKey(iso: string): string {
  return iso.slice(0, 7);
}

interface EventContent {
  title: React.ReactNode;
  description?: React.ReactNode;
}

function renderEvent(event: HistoryEvent): EventContent {
  switch (event.type) {
    case 'joined':
      return {
        title: 'Joined the club',
        description: 'The journey begins here.',
      };
    case 'level-reached':
      return {
        title: (
          <>
            Reached <span className="text-ink">Level {event.level}</span>
          </>
        ),
        description: (
          <>
            On the <span className="font-medium text-ink">{event.pathway}</span> pathway.
          </>
        ),
      };
    case 'speech-given':
      return {
        title: <>&ldquo;{event.title}&rdquo;</>,
        description: (
          <>
            Delivered at{' '}
            <span className="font-medium text-ink">Meeting #{event.meetingNumber}</span>
            {event.projectName ? (
              <>
                {' '}for the <span className="font-medium text-ink">{event.projectName}</span> project.
              </>
            ) : (
              '.'
            )}
          </>
        ),
      };
    case 'project-started':
      return {
        title: (
          <>
            Started <span className="text-ink">{event.projectName}</span>
          </>
        ),
        description: (
          <>
            Level {event.level} project on the {event.pathway} pathway.
          </>
        ),
      };
    case 'project-completed':
      return {
        title: (
          <>
            Completed <span className="text-ink">{event.projectName}</span>
          </>
        ),
        description: <>Level {event.level} project on the {event.pathway} pathway.</>,
      };
    case 'role-taken':
      return {
        title: (
          <>
            Served as <span className="text-ink">{event.role}</span>
          </>
        ),
        description: (
          <>
            At <span className="font-medium text-ink">Meeting #{event.meetingNumber}</span>.
          </>
        ),
      };
  }
}

interface TimelineNodeProps {
  event: HistoryEvent;
  isLast: boolean;
}

function TimelineNode({ event, isLast }: TimelineNodeProps) {
  const style = EVENT_STYLES[event.type];
  const content = renderEvent(event);
  const { Icon } = style;

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!isLast ? (
        <span
          aria-hidden
          className="absolute left-[19px] top-11 bottom-0 w-px bg-line-strong"
        />
      ) : null}

      <span
        aria-hidden
        className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ring-4 ring-canvas"
        style={{ backgroundColor: style.dotBg, color: style.dotFg }}
      >
        <Icon size={18} weight="bold" />
      </span>

      <div className="min-w-0 flex-1 rounded-xl border border-line bg-canvas p-4 transition-colors hover:border-line-strong">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: style.pillBg, color: style.pillFg }}
          >
            {style.label}
          </span>
          <time
            dateTime={event.date}
            className="text-xs font-medium text-ink-muted"
            aria-label={formatFullDate(event.date)}
          >
            {formatFullDate(event.date)}
          </time>
        </div>
        <h3 className="mt-2 text-sm font-semibold text-ink-soft">{content.title}</h3>
        {content.description ? (
          <p className="mt-1 text-xs text-ink-muted">{content.description}</p>
        ) : null}
      </div>
    </li>
  );
}

function TimelineSkeleton() {
  return (
    <div className="mx-auto max-w-3xl" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex gap-4 pb-6">
          <span className="size-10 shrink-0 animate-pulse rounded-full bg-fill-strong" />
          <div className="h-20 flex-1 animate-pulse rounded-xl border border-line bg-fill" />
        </div>
      ))}
    </div>
  );
}

export function HistoryTab({ member }: HistoryTabProps) {
  /* The API returns the stream already sorted latest-first, so grouping below
   * can walk it in one pass. */
  const { data: events, isError, error } = useGetMemberHistoryQuery(member.id);

  if (isError) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-fill">
          <WarningCircle size={18} className="text-ink-muted" />
        </div>
        <p className="mt-3 text-sm font-medium text-ink">Could not load the timeline</p>
        <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (!events) return <TimelineSkeleton />;

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-fill">
          <Flag size={18} className="text-ink-muted" />
        </div>
        <p className="mt-3 text-sm font-medium text-ink">Nothing on the timeline yet</p>
        <p className="mt-1 text-xs text-ink-muted">
          Speeches, projects, and level milestones will show up here as they happen.
        </p>
      </div>
    );
  }

  /* Group by year-month key so we can slot subtle dividers in without
   * disrupting the single ordered list. */
  const groups: { monthKey: string; label: string; events: HistoryEvent[] }[] = [];
  for (const event of events) {
    const monthKey = getMonthKey(event.date);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.monthKey === monthKey) {
      lastGroup.events.push(event);
    } else {
      groups.push({ monthKey, label: formatMonthLabel(event.date), events: [event] });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="relative">
        {groups.map((group, groupIndex) => (
          <Fragment key={group.monthKey}>
            <li className="relative mb-4 flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center"
              >
                <span className="size-2 rounded-full bg-line-strong" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {group.label}
              </span>
              <span aria-hidden className="h-px flex-1 bg-line" />
            </li>
            {group.events.map((event, eventIndex) => {
              const isLastInGroup = eventIndex === group.events.length - 1;
              const isLastGroup = groupIndex === groups.length - 1;
              const isLast = isLastGroup && isLastInGroup;
              return <TimelineNode key={event.id} event={event} isLast={isLast} />;
            })}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
