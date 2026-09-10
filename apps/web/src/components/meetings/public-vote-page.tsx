'use client';

import {
  CheckCircle,
  ClipboardText,
  LockSimple,
  Question,
  Warning,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Select, Spin } from 'antd';
import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  ensureVoterKey,
  type PublicMeetingVote,
  readLocalPicks,
  writeLocalPicks,
} from '@/lib/meetings/voting';
import { useGetPublicMeetingVoteQuery, useSubmitPublicMeetingVoteMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const MEETING_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** The anonymous ballot behind the Voting tab's QR/link. One Select per
 * award question, single choice each; the device carries a random voter key
 * (localStorage) so a resubmission replaces the earlier ballot rather than
 * stacking — one person, one vote, and no names collected. */
export function PublicVotePage() {
  const { message } = App.useApp();
  const params = useParams<{ meetingId: string }>();
  const search = useSearchParams();
  const meetingId = params?.meetingId ?? '';
  const token = search?.get('t') ?? '';

  /* The voter key only exists in the browser (localStorage). `ensureVoterKey`
   * is idempotent — reads the stored key, minting it on first visit — so a
   * memo is the right home for it; SSR renders '' and skips the query. */
  const voterKey = useMemo(() => (meetingId ? ensureVoterKey(meetingId) : ''), [meetingId]);

  const { data, isLoading } = useGetPublicMeetingVoteQuery(
    { meetingId, token, voterKey },
    { skip: !meetingId || !token || !voterKey },
  );
  const [submitVote, { isLoading: submitting }] = useSubmitPublicMeetingVoteMutation();

  /* Prefill layering, weakest to strongest: localStorage (instant on
   * revisit) → the server-stored ballot for this voter key (the truth) →
   * the user's in-progress edits (`draft`, null until the first touch).
   * Deriving rather than effect-syncing keeps this out of the
   * set-state-in-effect lint rule and means no selection is ever clobbered
   * by a late-arriving fetch. */
  const localPicks = useMemo(
    () => (voterKey ? readLocalPicks(meetingId) : {}),
    [voterKey, meetingId],
  );
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const picks = draft ?? data?.picks ?? localPicks;
  const [submitted, setSubmitted] = useState(false);

  const hasAnyPick = Object.values(picks).some(Boolean);

  async function handleSubmit() {
    const clean: Record<string, string> = {};
    for (const [category, candidateId] of Object.entries(picks)) {
      if (candidateId) clean[category] = candidateId;
    }
    try {
      await submitVote({ meetingId, token, voterKey, picks: clean }).unwrap();
      writeLocalPicks(meetingId, clean);
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not submit your vote — please try again.'));
    }
  }

  if (isLoading || !voterKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <Centered>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill text-ink-soft">
          <Warning size={22} />
        </div>
        <h1 className="mt-3 text-lg font-semibold text-ink">We couldn&apos;t find this meeting</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          The link may be out of date. Please ask the meeting organiser for a fresh link.
        </p>
      </Centered>
    );
  }

  const { meeting } = data;
  const ballotEmpty = data.categories.every((category) => category.candidates.length === 0);

  if (submitted) {
    return (
      <Centered>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle size={26} weight="fill" />
        </div>
        <h1 className="mt-3 text-lg font-semibold text-ink">Your vote is in!</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Thank you for voting. Results will be announced at the end of the meeting.
        </p>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
          <LockSimple size={13} />
          Your vote is anonymous — no name is attached to it.
        </p>
        <Button className="mt-5" onClick={() => setSubmitted(false)}>
          Change my vote
        </Button>
      </Centered>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-8 sm:py-12">
      {/* Header — same information hierarchy as the public agenda/role
       * pages: club, meeting label, then what this page is for. */}
      <header className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          {meeting.clubName}
        </p>
        <h1 className="mt-1 text-xl font-bold text-ink">
          Meeting #{meeting.meetingNumber}
          {meeting.theme ? ` · ${meeting.theme}` : ''}
        </h1>
        <p className="mt-1 text-xs text-ink-soft">
          {MEETING_DATE_FMT.format(new Date(meeting.dateTime))}
        </p>
        <p className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-1.5 text-xs text-ink-muted">
          <LockSimple size={13} className="shrink-0" />
          Voting is anonymous — pick your favourites, one per question.
        </p>
      </header>

      {ballotEmpty ? (
        <section className="mt-8 rounded-2xl border border-line bg-sidebar p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill text-ink-soft">
            <ClipboardText size={22} />
          </div>
          <h2 className="mt-3 text-base font-semibold text-ink">Voting isn&apos;t set up yet</h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            The meeting organiser hasn&apos;t published the ballot for this meeting. Check back in a
            moment.
          </p>
        </section>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-4">
            {data.categories.map((category) => (
              <QuestionCard
                key={category.key}
                category={category}
                value={picks[category.key]}
                onChange={(candidateId) => {
                  const next = { ...picks };
                  if (candidateId) next[category.key] = candidateId;
                  else delete next[category.key];
                  setDraft(next);
                }}
              />
            ))}
          </div>

          <Button
            type="primary"
            size="large"
            block
            className="mt-6"
            disabled={!hasAnyPick}
            loading={submitting}
            onClick={handleSubmit}
          >
            Submit my vote
          </Button>
          <p className="mt-3 text-center text-[11px] text-ink-muted">
            You can skip a question you don&apos;t want to answer. Submitting again from this device
            replaces your earlier vote.
          </p>
        </>
      )}
    </div>
  );
}

interface QuestionCardProps {
  category: PublicMeetingVote['categories'][number];
  value: string | undefined;
  onChange: (candidateId: string | undefined) => void;
}

/** One award question with its dropdown. Single selection only — the card
 * holds exactly one value; clearing the Select removes the pick. */
function QuestionCard({ category, value, onChange }: QuestionCardProps) {
  const options = useMemo(
    () => category.candidates.map((candidate) => ({ value: candidate.id, label: candidate.name })),
    [category.candidates],
  );

  return (
    <section className="rounded-2xl border border-line bg-sidebar p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="flex items-start gap-2 text-sm font-semibold text-ink">
        <Question size={16} weight="bold" className="mt-0.5 shrink-0 text-ink-muted" />
        {category.question}
      </h2>
      {category.candidates.length === 0 ? (
        <p className="mt-3 text-xs text-ink-muted">No options for this one — skip ahead.</p>
      ) : (
        <Select
          className="mt-3 w-full"
          size="large"
          showSearch
          allowClear
          value={value}
          onChange={(next: string | undefined) => onChange(next)}
          options={options}
          placeholder="Select a person…"
          optionFilterProp="label"
          aria-label={category.question}
        />
      )}
    </section>
  );
}

/** The narrow centered error/success card shell, shared with the public
 * role page's "couldn't find this meeting" panel. */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-line bg-sidebar p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {children}
      </section>
    </div>
  );
}
