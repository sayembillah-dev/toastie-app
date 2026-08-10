'use client';

import { ArrowRight, CalendarBlank, Clock, MicrophoneStage } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

import type { Meeting } from '@/lib/meetings/meetings';

import { useCountdown } from './use-countdown';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-14 flex-col items-center rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm sm:min-w-18 sm:px-4 sm:py-3">
      <span className="text-2xl font-semibold tabular-nums leading-none text-white sm:text-3xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-widest text-slate-300">
        {label}
      </span>
    </div>
  );
}

interface NextMeetingCardProps {
  meeting: Meeting | null;
  /** The label of whichever role this member holds at the meeting, e.g.
   * "Table Topics Master" — `null` when unassigned. */
  myRole: string | null;
}

/** The dashboard's hero: which meeting is coming up, how long until it
 * starts, and — the one thing every member actually wants to know at a
 * glance — whether they're on the agenda and in what capacity. */
export function NextMeetingCard({ meeting, myRole }: NextMeetingCardProps) {
  /* Called unconditionally — hooks can't follow the early return below — with
   * a stable placeholder target when there's no meeting to count down to. */
  const countdown = useCountdown(meeting?.dateTime ?? '2100-01-01T00:00:00Z');

  if (!meeting) {
    return (
      <section className="rounded-2xl border border-dashed border-line-strong bg-canvas px-6 py-10 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <CalendarBlank size={20} weight="bold" />
        </span>
        <h2 className="text-sm font-semibold text-ink">No meeting on the calendar</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-xs text-ink-soft">
          Once the next meeting is scheduled, its countdown and lineup will show up here.
        </p>
      </section>
    );
  }

  const startsAt = new Date(meeting.dateTime);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-800 via-slate-700 to-slate-900 px-5 py-5 text-white sm:px-7 sm:py-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-300">
            Next meeting · #{meeting.meetingNumber}
          </span>
          <h2 className="mt-1.5 text-xl font-semibold leading-tight sm:text-2xl">
            {meeting.theme}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-200">
            <span className="inline-flex items-center gap-1.5">
              <CalendarBlank size={14} weight="bold" className="text-slate-400" />
              <time dateTime={meeting.dateTime}>{DATE_FMT.format(startsAt)}</time>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} weight="bold" className="text-slate-400" />
              {TIME_FMT.format(startsAt)}
            </span>
          </div>
        </div>

        {myRole ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            <MicrophoneStage size={13} weight="bold" />
            You&rsquo;re {myRole}
          </span>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 sm:mt-7">
        {countdown && !countdown.isPast ? (
          <div className="flex gap-2 sm:gap-3">
            <CountdownUnit value={countdown.days} label="Days" />
            <CountdownUnit value={countdown.hours} label="Hrs" />
            <CountdownUnit value={countdown.minutes} label="Min" />
            <CountdownUnit value={countdown.seconds} label="Sec" />
          </div>
        ) : countdown?.isPast ? (
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white">
            Happening now
          </span>
        ) : (
          <div className="flex gap-2 sm:gap-3" aria-hidden>
            {['Days', 'Hrs', 'Min', 'Sec'].map((label) => (
              <div
                key={label}
                className="h-16.5 min-w-14 animate-pulse rounded-xl bg-white/10 sm:min-w-18"
              />
            ))}
          </div>
        )}

        <Link
          href={`/meetings/${meeting.id}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-900 no-underline transition-opacity hover:opacity-90"
        >
          View agenda
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>
    </section>
  );
}
