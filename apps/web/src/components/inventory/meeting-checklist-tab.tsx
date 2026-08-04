'use client';

import { CalendarCheck, ClockCounterClockwise } from '@phosphor-icons/react/dist/ssr';
import { Collapse, Skeleton } from 'antd';
import { useMemo, useSyncExternalStore } from 'react';

import { MeetingChecklist } from '@/components/checklist/meeting-checklist';
import type { Meeting } from '@/lib/meetings/meetings';
import { partitionMeetings } from '@/lib/meetings/meetings';
import { useGetMeetingsQuery } from '@/store/api';

/* Same client-clock trick the meetings hub uses so hydration stays
 * deterministic — `useSyncExternalStore` requires a stable snapshot, so the
 * timestamp is minted once and reused for every render on this client. */
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

const MEETING_LABEL_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function meetingLabel(meeting: Meeting): string {
  return `#${meeting.meetingNumber} · ${MEETING_LABEL_FMT.format(new Date(meeting.dateTime))}${
    meeting.theme ? ` · ${meeting.theme}` : ''
  }`;
}

/** Inventory › Meeting checklist. Puts the current meeting's checklist front
 * and centre — same rows as the meeting page, edits flow through the same
 * cache — and lists past meetings underneath as a read-only archive. */
export function MeetingChecklistTab() {
  const now = useClientNow();
  const { data: meetings, isLoading } = useGetMeetingsQuery();

  const partitioned = useMemo(() => {
    if (now === null || !meetings) {
      return { past: [] as Meeting[], current: null as Meeting | null };
    }
    const { past, current } = partitionMeetings(meetings, now);
    return { past, current };
  }, [meetings, now]);

  if (isLoading || now === null || !meetings) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
          <Skeleton active title paragraph={{ rows: 5 }} />
        </div>
      </section>
    );
  }

  const { current, past } = partitioned;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 font-medium text-ink">
            <CalendarCheck size={14} weight="bold" />
            Current meeting
          </span>
          {current ? (
            <span className="text-ink-muted">{meetingLabel(current)}</span>
          ) : (
            <span className="text-ink-muted">No upcoming meeting</span>
          )}
        </div>

        {current ? (
          <MeetingChecklist
            meetingId={current.id}
            title="Pre-Meeting Checklist"
            subtitle="Same list as the meeting page — edits from here show up there too."
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-line-strong bg-canvas p-6 text-center">
            <p className="text-sm font-medium text-ink">No meeting to prep for</p>
            <p className="mt-1 text-xs text-ink-muted">
              Once a meeting is scheduled, its checklist will land here.
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 font-medium text-ink">
            <ClockCounterClockwise size={14} weight="bold" />
            Archive
          </span>
          <span className="text-ink-muted">
            {past.length === 0
              ? 'Past meeting checklists show up here.'
              : `${past.length} past ${past.length === 1 ? 'meeting' : 'meetings'}`}
          </span>
        </div>

        {past.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-canvas p-6 text-center">
            <p className="text-sm font-medium text-ink">No archived checklists yet</p>
            <p className="mt-1 text-xs text-ink-muted">
              Once meetings roll past, their checklists land here as a read-only record.
            </p>
          </div>
        ) : (
          <Collapse
            accordion
            items={past.map((meeting) => ({
              key: meeting.id,
              label: <span className="text-sm font-medium text-ink">{meetingLabel(meeting)}</span>,
              children: (
                <MeetingChecklist
                  meetingId={meeting.id}
                  readOnly
                  title="Checklist"
                  subtitle="Read-only archive of what was on the list for this meeting."
                />
              ),
            }))}
          />
        )}
      </div>
    </div>
  );
}
