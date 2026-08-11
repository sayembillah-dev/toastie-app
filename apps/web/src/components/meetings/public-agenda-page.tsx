'use client';

import {
  CalendarBlank,
  Clock,
  Quotes,
  TextAa,
  UsersThree,
  Warning,
} from '@phosphor-icons/react/dist/ssr';
import { Spin } from 'antd';
import { useMemo } from 'react';

import { buildAgenda, holderName } from '@/lib/meetings/agenda';
import type { DraftSpeaker, MeetingDraft, RoleHolder } from '@/lib/meetings/draft';
import { EMPTY_DRAFT } from '@/lib/meetings/draft';
import type { Meeting } from '@/lib/meetings/meetings';
import type { PublicMeetingAgenda } from '@/lib/meetings/public-agenda';
import { buildRoles } from '@/lib/meetings/roles';
import { useGetPublicMeetingAgendaQuery } from '@/store/api';

const MEETING_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const CLOCK_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/* The four roles the room actually looks to during the meeting — everything
 * else on `buildRoles` falls into "Other roles" below. */
const MENTOR_KEYS = [
  'toastmaster',
  'general-evaluator',
  'table-topic-master',
  'table-topic-evaluator',
];

function initialsOf(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
}

/** No id ever needs resolving here — every role/speaker slot the public
 * endpoint returns already carries a plain display name (see `RoleHolder`
 * and `DraftSpeaker`'s guest-style fields), so `buildAgenda`'s roster
 * lookup is never actually called. */
function noNameLookup(): string {
  return '';
}

/** Reshapes the public wire payload into the same `Meeting`/`MeetingDraft`
 * pair the authed Overview tab and Agenda sheet build from, so this page
 * can reuse `buildAgenda`/`buildRoles` instead of re-deriving the run of
 * show. `clubId`/`shareToken` are unused by those helpers — filled with
 * placeholders rather than widening their signatures for one caller. */
function toMeetingAndDraft(agenda: PublicMeetingAgenda): { meeting: Meeting; draft: MeetingDraft } {
  const meeting: Meeting = {
    id: agenda.id,
    clubId: '',
    meetingNumber: agenda.meetingNumber,
    dateTime: agenda.dateTime,
    theme: agenda.theme,
    status: 'published',
    shareToken: '',
  };

  const roles: Record<string, RoleHolder | undefined> = {};
  for (const role of agenda.roles) {
    roles[role.roleKey] = { name: role.name };
  }

  const speakers: DraftSpeaker[] = agenda.speakers.map((speaker) => ({
    id: `speaker-${speaker.order}`,
    status: 'confirmed',
    speakerName: speaker.speakerName || undefined,
    evaluatorName: speaker.evaluatorName || undefined,
    duration: speaker.duration ?? undefined,
    title: speaker.title,
    pathway: (speaker.pathway ?? undefined) as DraftSpeaker['pathway'],
    project: speaker.project ?? undefined,
  }));

  const draft: MeetingDraft = {
    theme: agenda.theme,
    word: agenda.word ?? EMPTY_DRAFT.word,
    roles,
    speakers,
  };

  return { meeting, draft };
}

function NotFoundCard() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-line bg-sidebar p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill text-ink-soft">
          <Warning size={22} />
        </div>
        <h1 className="mt-3 text-lg font-semibold text-ink">This agenda isn&apos;t available</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          It may not be published yet, or the link may be out of date. Please check with the meeting
          organiser.
        </p>
      </section>
    </div>
  );
}

function RoleCard({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-canvas p-4">
      <span
        aria-hidden
        className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          name ? 'bg-slate-700 text-white' : 'bg-fill text-ink-muted'
        }`}
      >
        {name ? initialsOf(name) : '—'}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </p>
        <p className={`truncate text-sm ${name ? 'font-medium text-ink' : 'text-ink-muted'}`}>
          {name || 'Unassigned'}
        </p>
      </div>
    </div>
  );
}

function OtherRoleBox({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-sidebar px-4 py-3">
      <span className="text-xs text-ink-soft">{label}</span>
      <span className={`text-sm ${name ? 'font-medium text-ink' : 'text-ink-muted'}`}>
        {name || 'Unassigned'}
      </span>
    </div>
  );
}

interface PublicAgendaPageProps {
  meetingId: string;
}

/** Public, no-login agenda page — anyone with the meeting id can view it once
 * the organiser publishes the meeting. Reads through `getPublicMeetingAgenda`
 * (gated server-side on `status === 'published'`) and renders the same run
 * of show the club sees on the meeting's Overview tab and printed agenda. */
export function PublicAgendaPage({ meetingId }: PublicAgendaPageProps) {
  const {
    data: agenda,
    isLoading,
    isError,
  } = useGetPublicMeetingAgendaQuery(meetingId, { skip: !meetingId });

  const { meeting, draft, rows } = useMemo(() => {
    if (!agenda) return { meeting: null, draft: null, rows: [] };
    const { meeting: builtMeeting, draft: builtDraft } = toMeetingAndDraft(agenda);
    return {
      meeting: builtMeeting,
      draft: builtDraft,
      rows: buildAgenda(builtMeeting, builtDraft, noNameLookup),
    };
  }, [agenda]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !agenda || !meeting || !draft) {
    return <NotFoundCard />;
  }

  const roles = buildRoles(meeting);
  const mentors = roles.filter((role) => MENTOR_KEYS.includes(role.key));
  const others = roles.filter((role) => !MENTOR_KEYS.includes(role.key));
  const startsAt = new Date(meeting.dateTime);
  const { word } = draft;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-linear-to-br from-slate-800 via-slate-700 to-slate-900 px-4 py-8 text-white sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-300">
            {agenda.clubName} · Meeting #{meeting.meetingNumber}
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{draft.theme}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-200">
            <span className="inline-flex items-center gap-1.5">
              <CalendarBlank size={14} weight="bold" className="text-slate-400" />
              {MEETING_DATE_FMT.format(startsAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} weight="bold" className="text-slate-400" />
              {CLOCK_FMT.format(startsAt)}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-6">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Meet the Mentors
          </h2>
          <p className="mb-3 text-sm text-ink-soft">
            Here&apos;s who&apos;s leading today&apos;s meeting.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mentors.map((role) => (
              <RoleCard
                key={role.key}
                label={role.label}
                name={holderName(noNameLookup, draft.roles[role.key])}
              />
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Other Roles
          </h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {others.map((role) => (
              <OtherRoleBox
                key={role.key}
                label={role.label}
                name={holderName(noNameLookup, draft.roles[role.key])}
              />
            ))}
          </div>
        </section>

        {word.word.trim() ? (
          <section className="mb-6 rounded-2xl border border-line bg-sidebar p-4 sm:p-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink-muted">
              <TextAa size={14} weight="bold" />
              Word of the Day
            </h2>
            <p className="text-xl font-semibold text-ink">
              {word.word}
              {word.partOfSpeech ? (
                <span className="ml-2 text-sm font-normal italic text-ink-muted">
                  {word.partOfSpeech}
                </span>
              ) : null}
            </p>
            {word.meaning ? <p className="mt-2 text-sm text-ink-soft">{word.meaning}</p> : null}
            {word.example ? (
              <p className="mt-3 flex gap-2 border-t border-line pt-3 text-xs italic text-ink-soft">
                <Quotes size={14} weight="fill" className="mt-0.5 shrink-0 text-ink-muted" />
                {word.example}
              </p>
            ) : null}
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            <UsersThree size={14} weight="bold" />
            Agenda Timeline
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line">
            {rows.map((row, index) => (
              <div key={row.title} className={index > 0 ? 'border-t border-line' : ''}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-sidebar px-4 py-3">
                  <span className="w-16 shrink-0 text-xs font-semibold text-ink-muted">
                    {CLOCK_FMT.format(row.startsAt)}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-ink">{row.title}</span>
                  {row.person ? (
                    <span className="text-xs font-medium text-ink-soft">{row.person}</span>
                  ) : null}
                  {row.displayMinutes ? (
                    <span className="text-xs text-ink-muted">{row.displayMinutes}&apos;</span>
                  ) : null}
                </div>
                {row.lines.length > 0 ? (
                  <div className="divide-y divide-line px-4">
                    {row.lines.map((line) => (
                      <div
                        key={line.key}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 pl-16"
                      >
                        <span
                          className={`flex-1 text-sm ${line.meta ? 'italic text-ink-muted' : 'text-ink-soft'}`}
                        >
                          {line.label}
                        </span>
                        {line.person ? (
                          <span className="text-xs font-medium text-ink-soft">{line.person}</span>
                        ) : null}
                        {line.minutes ? (
                          <span className="text-xs text-ink-muted">{line.minutes}&apos;</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
