'use client';

import {
  CalendarBlank,
  CheckCircle,
  Clock,
  Hourglass,
  MicrophoneStage,
  PencilSimple,
  Quotes,
  TextAa,
  UsersThree,
  Warning,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, DatePicker, InputNumber, Modal, Progress, TimePicker } from 'antd';
import { useMemo, useState } from 'react';
import { ReadOnly } from '@/components/permissions/read-only';
import { PersonAvatar } from '@/components/ui/person-avatar';
import dayjs, { type Dayjs } from '@/lib/dayjs';
import type { Member } from '@/lib/education/members';
import { buildAgenda, holderName } from '@/lib/meetings/agenda';
import { splitLocalDateTime, toInstant } from '@/lib/meetings/datetime';
import type { DraftSpeaker, MeetingDraft } from '@/lib/meetings/draft';
import type { Meeting, MeetingStatus } from '@/lib/meetings/meetings';
import { DEFAULT_START_TIME } from '@/lib/meetings/meetings';
import { MAX_SPEAKERS_PER_MEETING } from '@/lib/meetings/prepared-speakers';
import { buildRoles } from '@/lib/meetings/roles';
import { useUpdateMeetingMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppSelector } from '@/store/hooks';
import { selectMeetingDraft } from '@/store/meeting-draft-slice';

import { useMemberOf, useNameOf } from './use-name-of';

/** A full slate is every prepared-speaker slot the meeting offers — the
 * readiness meter reads anything at or above it as a full house. */
const TARGET_SPEAKERS = MAX_SPEAKERS_PER_MEETING;

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Matches the agenda sheet's clock format so both views read the same. */
const CLOCK_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/* Kept in sync with meeting-card so the same status reads the same everywhere. */
const STATUS_STYLES: Record<MeetingStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draft', bg: '#FEF3C7', fg: '#78350F' },
  published: { label: 'Published', bg: '#D1FAE5', fg: '#065F46' },
};

function initialsOf(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
}

interface ReadinessCheck {
  key: string;
  label: string;
  done: number;
  total: number;
}

interface Readiness {
  checks: ReadinessCheck[];
  /** Mean of the checks' ratios, so adding a speaker can't tank the score the
   * way a single done/total fraction over a growing denominator would. */
  percent: number;
  gaps: string[];
}

function isSpeakerComplete(speaker: DraftSpeaker): boolean {
  return Boolean(
    (speaker.memberId || speaker.guestId) &&
      speaker.title.trim() &&
      (speaker.evaluatorId || speaker.evaluatorGuestId),
  );
}

function buildReadiness(meeting: Meeting, draft: MeetingDraft): Readiness {
  /* Optional roles (e.g. Hakmaster) are excluded — a meeting is ready without
   * them, so an unassigned optional role must never read as a gap. */
  const roles = buildRoles(meeting).filter((role) => !role.optional);
  const unassigned = roles.filter((role) => !draft.roles[role.key]);
  const themeParts = [draft.theme.trim() || meeting.theme, draft.word.word, draft.word.meaning];
  const themeDone = themeParts.filter((part) => part.trim()).length;
  const speakersComplete = draft.speakers.filter(isSpeakerComplete).length;

  const checks: ReadinessCheck[] = [
    {
      key: 'roles',
      label: 'Roles assigned',
      done: roles.length - unassigned.length,
      total: roles.length,
    },
    { key: 'theme', label: 'Theme & word of the day', done: themeDone, total: themeParts.length },
    {
      key: 'speakers',
      label: 'Speakers booked',
      done: Math.min(draft.speakers.length, TARGET_SPEAKERS),
      total: TARGET_SPEAKERS,
    },
    {
      key: 'details',
      label: 'Speech details filled',
      done: speakersComplete,
      /* Never divide by zero — with no speakers this check simply reads 0/1. */
      total: Math.max(draft.speakers.length, 1),
    },
  ];

  const percent = Math.round(
    (checks.reduce((sum, check) => sum + check.done / check.total, 0) / checks.length) * 100,
  );

  /* Ordered by how early in planning each gap normally gets closed, so the top
   * of the list is always the next thing worth doing. */
  const gaps: string[] = [];
  if (!draft.word.word.trim()) gaps.push('Word of the day is not set');
  else if (!draft.word.meaning.trim()) gaps.push('Word of the day has no meaning yet');
  if (draft.speakers.length < TARGET_SPEAKERS) {
    const missing = TARGET_SPEAKERS - draft.speakers.length;
    gaps.push(`Book ${missing} more prepared speaker${missing > 1 ? 's' : ''}`);
  }
  draft.speakers.forEach((speaker, index) => {
    if (!speaker.memberId && !speaker.guestId) gaps.push(`Speech ${index + 1} has no speaker`);
    if (!speaker.title.trim()) gaps.push(`Speech ${index + 1} has no title`);
    if (!speaker.evaluatorId && !speaker.evaluatorGuestId)
      gaps.push(`Speech ${index + 1} has no evaluator`);
  });
  for (const role of unassigned) gaps.push(`${role.label} is unassigned`);

  return { checks, percent, gaps };
}

function Card({
  title,
  Icon,
  trailing,
  children,
}: {
  title: string;
  Icon: React.ComponentType<{ size?: number; weight?: 'bold'; className?: string }>;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
      <header className="mb-3 flex items-center gap-2">
        <Icon size={14} weight="bold" className="text-ink-muted" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">{title}</h3>
        {trailing ? <div className="ml-auto">{trailing}</div> : null}
      </header>
      {children}
    </section>
  );
}

function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-fill px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
      {children}
    </span>
  );
}

interface EditMeetingDetailsModalProps {
  open: boolean;
  meeting: Meeting;
  onClose: () => void;
}

/** Meeting number and date/time have no editor anywhere else — the planner
 * is the only place that sets them today. This is the one spot on the
 * meeting page itself to fix a typo'd number or reschedule after creation;
 * the edit carries onto the linked planner row server-side (see
 * `syncPlannerFieldsFromMeeting`). */
function EditMeetingDetailsModal({ open, meeting, onClose }: EditMeetingDetailsModalProps) {
  const { message } = App.useApp();
  const [updateMeeting, { isLoading }] = useUpdateMeetingMutation();
  const initial = splitLocalDateTime(meeting.dateTime);
  const [meetingNumber, setMeetingNumber] = useState<number | null>(meeting.meetingNumber);
  const [date, setDate] = useState<Dayjs | null>(
    initial.date ? dayjs(initial.date, 'YYYY-MM-DD') : null,
  );
  const [time, setTime] = useState<Dayjs | null>(dayjs(initial.time, 'HH:mm'));
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      const parts = splitLocalDateTime(meeting.dateTime);
      setMeetingNumber(meeting.meetingNumber);
      setDate(parts.date ? dayjs(parts.date, 'YYYY-MM-DD') : null);
      setTime(dayjs(parts.time, 'HH:mm'));
      setError(null);
    }
  }

  async function handleSave() {
    if (meetingNumber === null || !date) return;
    setError(null);
    try {
      /* A cleared — or unparseable — time falls back to the club's default
       * inside `toInstant` rather than formatting to "Invalid Date" and
       * sending the API a date-time string it can only reject. */
      const timeStr = time?.isValid() ? time.format('HH:mm') : DEFAULT_START_TIME;
      await updateMeeting({
        meetingId: meeting.id,
        meetingNumber,
        dateTime: toInstant(date, timeStr),
      }).unwrap();
      message.success('Meeting details updated');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the change'));
    }
  }

  return (
    <Modal
      open={open}
      afterOpenChange={handleOpenChange}
      onCancel={onClose}
      onOk={() => {
        void handleSave();
      }}
      confirmLoading={isLoading}
      okText="Save"
      cancelText="Cancel"
      okButtonProps={{ disabled: meetingNumber === null || !date }}
      title="Edit meeting number, date & time"
      centered
    >
      <div className="flex flex-col gap-3 pt-2">
        <div className="grid grid-cols-[6rem_1fr_1fr] gap-3">
          <div>
            <label htmlFor="hero-edit-number" className="mb-1 block text-xs font-medium text-ink">
              No.
            </label>
            <InputNumber
              id="hero-edit-number"
              className="w-full"
              min={1}
              precision={0}
              value={meetingNumber}
              onChange={(value) => setMeetingNumber(value ?? null)}
            />
          </div>
          <div>
            <label htmlFor="hero-edit-date" className="mb-1 block text-xs font-medium text-ink">
              Date
            </label>
            <DatePicker
              id="hero-edit-date"
              className="w-full"
              format="D MMM YYYY"
              value={date}
              onChange={(value) => setDate(value)}
            />
          </div>
          <div>
            <label htmlFor="hero-edit-time" className="mb-1 block text-xs font-medium text-ink">
              Time
            </label>
            <TimePicker
              id="hero-edit-time"
              className="w-full"
              format="h:mm A"
              use12Hours
              minuteStep={5}
              value={time}
              onChange={(value) => setTime(value)}
            />
          </div>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

/** Headline card: which meeting this is, and the window it occupies. */
function Hero({
  meeting,
  theme,
  startsAt,
  endsAt,
  runtime,
}: {
  meeting: Meeting;
  theme: string;
  startsAt: Date;
  endsAt: Date;
  runtime: number;
}) {
  const status = STATUS_STYLES[meeting.status];
  const [editOpen, setEditOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl bg-linear-to-br from-slate-800 via-slate-700 to-slate-900 px-5 py-5 text-white sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-300">
          Meeting #{meeting.meetingNumber}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: status.bg, color: status.fg }}
        >
          {status.label}
        </span>
      </div>
      <EditMeetingDetailsModal
        open={editOpen}
        meeting={meeting}
        onClose={() => setEditOpen(false)}
      />

      <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{theme}</h2>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-200">
        <span className="inline-flex items-center gap-1.5">
          <CalendarBlank size={14} weight="bold" className="text-slate-400" />
          <time dateTime={meeting.dateTime}>{DATE_FMT.format(startsAt)}</time>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={14} weight="bold" className="text-slate-400" />
          {CLOCK_FMT.format(startsAt)} → {CLOCK_FMT.format(endsAt)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Hourglass size={14} weight="bold" className="text-slate-400" />
          {runtime} min run time
        </span>
        <ReadOnly resource="meeting">
          <Button
            type="text"
            size="small"
            className="print-hidden h-6! gap-1 px-1.5! text-xs! text-slate-300! hover:bg-white/10! hover:text-white!"
            aria-label="Edit meeting number, date and time"
            icon={<PencilSimple size={12} weight="bold" />}
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
        </ReadOnly>
      </div>
    </section>
  );
}

/** Readiness meter plus the shortlist of what is still open. */
function ReadinessCard({ readiness }: { readiness: Readiness }) {
  const { checks, percent, gaps } = readiness;
  const shown = gaps.slice(0, 5);

  return (
    <Card title="Meeting readiness" Icon={CheckCircle}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="shrink-0 self-center">
          <Progress
            type="circle"
            percent={percent}
            size={96}
            strokeColor={percent === 100 ? '#059669' : '#334155'}
            railColor="#f2f2f2"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {checks.map((check) => {
            const ratio = Math.round((check.done / check.total) * 100);
            return (
              <div key={check.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-ink-soft">{check.label}</span>
                  <span className="font-medium text-ink">
                    {check.done}/{check.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-fill">
                  <div
                    className={`h-full rounded-full ${ratio === 100 ? 'bg-emerald-600' : 'bg-slate-700'}`}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        {gaps.length === 0 ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle size={14} weight="fill" />
            Everything is set — this agenda is ready to publish.
          </p>
        ) : (
          <>
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink">
              <Warning size={14} weight="bold" className="text-amber-600" />
              Next up ({gaps.length} open)
            </p>
            <ul className="flex flex-col gap-1">
              {shown.map((gap) => (
                <li key={gap} className="flex items-start gap-2 text-xs text-ink-soft">
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" />
                  {gap}
                </li>
              ))}
              {gaps.length > shown.length ? (
                <li className="pl-3 text-xs text-ink-muted">
                  +{gaps.length - shown.length} more to sort out
                </li>
              ) : null}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

/** Every meeting role with the member holding it, unassigned ones called out. */
function RolesCard({
  meeting,
  draft,
  nameOf,
  memberOf,
}: {
  meeting: Meeting;
  draft: MeetingDraft;
  nameOf: (memberId: string | undefined) => string;
  memberOf: (memberId: string | undefined) => Member | undefined;
}) {
  /* An optional role that nobody holds is left off the card entirely, so the
   * filled/total pill only ever counts roles the meeting actually uses. */
  const roles = buildRoles(meeting).filter((role) => !role.optional || draft.roles[role.key]);
  const filled = roles.filter((role) => draft.roles[role.key]).length;

  return (
    <Card
      title="Who's running it"
      Icon={UsersThree}
      trailing={
        <CountPill>
          {filled}/{roles.length}
        </CountPill>
      }
    >
      <ul className="flex flex-col gap-2">
        {roles.map((role) => {
          const holder = draft.roles[role.key];
          const name = holderName(nameOf, holder);
          // A role can be filled by a free-text name (a visiting guest), which
          // has no member behind it and so no photo — initials as before.
          const member = memberOf(holder?.memberId);
          return (
            <li key={role.key} className="flex items-center gap-2.5">
              <PersonAvatar
                src={member?.avatarUrl}
                initials={name ? initialsOf(name) : '—'}
                sizeClass="size-7"
                textClass="text-[10px]"
                fallbackClass={name ? 'bg-slate-700 text-white' : 'bg-fill text-ink-muted'}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">{role.label}</span>
              <span
                className={`shrink-0 text-xs ${name ? 'font-medium text-ink' : 'text-ink-muted'}`}
              >
                {name || 'Unassigned'}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** The prepared-speech slate, with the pathway context each speech carries. */
function SpeakersCard({
  draft,
  nameOf,
}: {
  draft: MeetingDraft;
  nameOf: (memberId: string | undefined) => string;
}) {
  return (
    <Card
      title="Speech lineup"
      Icon={MicrophoneStage}
      trailing={<CountPill>{draft.speakers.length} booked</CountPill>}
    >
      {draft.speakers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-muted">
          No prepared speakers yet — add them on the Prepared Speakers tab and they will appear here
          and on the agenda.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {draft.speakers.map((speaker, index) => {
            const speakerName = speaker.memberId
              ? nameOf(speaker.memberId)
              : (speaker.speakerName ?? '');
            const evaluator = speaker.evaluatorId
              ? nameOf(speaker.evaluatorId)
              : (speaker.evaluatorName ?? '');
            const context = [speaker.pathway, speaker.project].filter(Boolean).join(' · ');

            return (
              <li key={speaker.id} className="rounded-xl border border-line bg-sidebar p-3">
                <div className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-fill text-[11px] font-semibold text-ink-soft"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {speaker.title.trim() || 'Untitled speech'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {speakerName || 'Speaker to be confirmed'}
                      {evaluator ? ` · evaluated by ${evaluator}` : ''}
                    </p>
                    {context ? (
                      <p className="mt-0.5 truncate text-[11px] text-ink-muted">{context}</p>
                    ) : null}
                  </div>
                  {speaker.duration ? (
                    <span className="shrink-0 text-xs font-medium text-ink-soft">
                      {speaker.duration} min
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/** The grammarian's word, laid out the way it is read to the room. */
function WordCard({ draft }: { draft: MeetingDraft }) {
  const { word } = draft;

  if (!word.word.trim()) {
    return (
      <Card title="Word of the day" Icon={TextAa}>
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-muted">
          Not set yet — the Theme tab feeds this card and the agenda sheet.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Word of the day" Icon={TextAa}>
      <p className="text-2xl font-semibold text-ink">{word.word}</p>
      {word.partOfSpeech ? (
        <p className="mt-0.5 text-xs italic text-ink-muted">({word.partOfSpeech})</p>
      ) : null}
      {word.meaning ? <p className="mt-3 text-sm text-ink-soft">{word.meaning}</p> : null}
      {word.example ? (
        <p className="mt-3 flex gap-2 border-t border-line pt-3 text-xs italic text-ink-soft">
          <Quotes size={14} weight="fill" className="mt-0.5 shrink-0 text-ink-muted" />
          {word.example}
        </p>
      ) : null}
    </Card>
  );
}

interface AtAGlanceProps {
  meeting: Meeting;
}

/**
 * The meeting's control panel: what it is, how close it is to being ready, who
 * is holding each role, what is being spoken, and the word of the day. Every
 * number here is derived from the same meeting draft the Agenda sheet prints,
 * so the two can never disagree.
 */
export function AtAGlance({ meeting }: AtAGlanceProps) {
  const draft = useAppSelector((state) => selectMeetingDraft(state, meeting.id));
  const nameOf = useNameOf();
  const memberOf = useMemberOf();

  /* Reuses the agenda builder rather than re-deriving timings: the run-of-show
   * is the only thing that knows how long the meeting actually takes. */
  const { startsAt, endsAt, runtime } = useMemo(() => {
    const rows = buildAgenda(meeting, draft, nameOf);
    const start = new Date(meeting.dateTime);
    const end = rows[rows.length - 1].startsAt;
    return {
      startsAt: start,
      endsAt: end,
      runtime: Math.round((end.getTime() - start.getTime()) / 60_000),
    };
  }, [meeting, draft, nameOf]);

  const readiness = useMemo(() => buildReadiness(meeting, draft), [meeting, draft]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Hero
        meeting={meeting}
        theme={draft.theme.trim() || meeting.theme}
        startsAt={startsAt}
        endsAt={endsAt}
        runtime={runtime}
      />

      <ReadinessCard readiness={readiness} />

      {/* Roles is the tallest card, so it takes the left column and the two
       * shorter cards stack beside it on wide screens. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RolesCard meeting={meeting} draft={draft} nameOf={nameOf} memberOf={memberOf} />
        <div className="flex flex-col gap-4">
          <SpeakersCard draft={draft} nameOf={nameOf} />
          <WordCard draft={draft} />
        </div>
      </div>
    </div>
  );
}
