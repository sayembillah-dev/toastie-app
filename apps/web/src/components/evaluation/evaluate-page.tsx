'use client';

import {
  ArrowsCounterClockwise,
  CheckCircle,
  ImageSquare,
  Microphone,
  PaperPlaneTilt,
  TextAa,
  Warning,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Spin, Tabs } from 'antd';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useState, useSyncExternalStore } from 'react';

import { AudioTab } from '@/components/evaluation/audio-tab';
import { IdentityGate } from '@/components/evaluation/identity-gate';
import { ImageTab } from '@/components/evaluation/image-tab';
import { SpeakerHeader } from '@/components/evaluation/speaker-header';
import { TextTab } from '@/components/evaluation/text-tab';
import { findProject, getProjectDuration } from '@/lib/education/pathways';
import type { EvaluatorIdentity } from '@/lib/evaluation/storage';
import {
  clearIdentity,
  parseIdentity,
  readIdentityRaw,
  submitEvaluation,
  subscribeToIdentity,
  writeIdentity,
} from '@/lib/evaluation/storage';
import { usePersistentTab } from '@/lib/ui/use-persistent-tab';
import { useGetPublicMeetingQuery } from '@/store/api';
import { useAppSelector } from '@/store/hooks';
import { selectMeetingDraft } from '@/store/meeting-draft-slice';

const MEETING_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

type SubmitState = 'idle' | 'submitting' | 'submitted';

export function EvaluatePage() {
  const params = useParams<{ meetingId: string; speakerId: string }>();
  const search = useSearchParams();
  const meetingId = params?.meetingId ?? '';
  const speakerId = params?.speakerId ?? '';
  const token = search?.get('t') ?? '';

  const { message } = App.useApp();

  const { data: meeting, isLoading: meetingLoading } = useGetPublicMeetingQuery(
    { meetingId, token },
    { skip: !meetingId || !token },
  );
  // Speakers/roster live in a per-browser draft — anonymous evaluators
  // never have them populated. The name lookups gracefully degrade so
  // the header renders with empty strings and the identity gate falls
  // back to a generic "tell us who you are" prompt.
  const draft = useAppSelector((state) => selectMeetingDraft(state, meetingId));

  const speaker = draft.speakers.find((entry) => entry.id === speakerId);
  const speakerName = '';
  const evaluatorName = '';

  const project = speaker?.project ? findProject(speaker.project, speaker.pathway) : undefined;
  const duration = speaker ? getProjectDuration(project?.name, speaker.pathway) : undefined;

  const meetingLabel = meeting
    ? `Meeting #${meeting.meetingNumber} · ${MEETING_DATE_FMT.format(new Date(meeting.dateTime))}`
    : '';
  const clubName = meeting?.clubName ?? '';

  const { activeKey, onChange: onTabChange } = usePersistentTab('tab', 'audio');

  /* Identity is synced from localStorage via useSyncExternalStore so a same-tab
   * write (see `writeIdentity`) notifies subscribers without us needing to
   * setState from inside an effect. On the server (and during hydration) the
   * snapshot is `null` — the outer isLoading gate hides the meaningful UI until
   * the client snapshot has run, so a returning evaluator doesn't see the gate
   * flash before the form. */
  const identityRaw = useSyncExternalStore(
    useCallback(
      (notify) => subscribeToIdentity(meetingId, speakerId, notify),
      [meetingId, speakerId],
    ),
    () => readIdentityRaw(meetingId, speakerId),
    () => null,
  );
  const identity = parseIdentity(identityRaw);

  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const hasContent = !!audio || images.length > 0 || text.trim().length > 0;
  const isLoading = meetingLoading;

  function handleIdentityConfirmed(next: Omit<EvaluatorIdentity, 'confirmedAt'>) {
    writeIdentity(meetingId, speakerId, next);
  }

  function handleSwitchIdentity() {
    clearIdentity(meetingId, speakerId);
  }

  async function handleSubmit() {
    if (!identity || !hasContent || !meeting || !speaker) return;
    setSubmitState('submitting');
    try {
      await submitEvaluation({
        meetingId,
        speakerId,
        speakerMemberId: speaker.memberId,
        meetingNumber: meeting.meetingNumber,
        speechTitle: speaker.title.trim(),
        evaluator: identity,
        audio: audio ?? undefined,
        audioDurationSec: audioDurationSec ?? undefined,
        images,
        text,
      });
      setSubmitState('submitted');
    } catch {
      setSubmitState('idle');
      message.error('Could not send your evaluation. Please try again.');
    }
  }

  /* ---------------------------------------------------------------- states */

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spin size="large" />
      </div>
    );
  }

  if (!meeting || !speaker) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center px-4 py-10">
        <section className="w-full rounded-2xl border border-line bg-sidebar p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill text-ink-soft">
            <Warning size={22} />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-ink">
            We couldn&apos;t find this evaluation
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            The link may be out of date, or the speaker was removed from the agenda. Please ask the
            meeting organiser for a fresh link.
          </p>
        </section>
      </div>
    );
  }

  if (submitState === 'submitted') {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center px-4 py-10">
        <section className="w-full rounded-2xl border border-line bg-sidebar p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle size={28} weight="fill" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-ink">Thanks — feedback sent</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {speakerName ? `${speakerName} ` : 'The speaker '}
            will receive your evaluation. You can close this tab safely.
          </p>
        </section>
      </div>
    );
  }

  if (!identity) {
    return (
      <IdentityGate
        clubName={clubName}
        meetingLabel={meetingLabel}
        speakerName={speakerName}
        speechTitle={speaker.title.trim()}
        assignedEvaluatorName={evaluatorName || undefined}
        onConfirmed={handleIdentityConfirmed}
      />
    );
  }

  /* ------------------------------------------------------ evaluation form */

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SpeakerHeader
        clubName={clubName}
        meetingLabel={meetingLabel}
        speakerName={speakerName}
        speechTitle={speaker.title.trim()}
        pathway={speaker.pathway}
        project={project}
        duration={duration}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-sidebar px-4 py-2.5">
          <p className="text-[12px] text-ink-soft">
            Signed in as <span className="font-semibold text-ink">{identity.name}</span>
            {identity.isAssignedEvaluator ? (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                Assigned evaluator
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={handleSwitchIdentity}
            className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
          >
            <ArrowsCounterClockwise size={12} weight="bold" />
            Not you?
          </button>
        </div>

        <section className="rounded-2xl border border-line bg-sidebar p-3 sm:p-5">
          <div className="mb-2 px-1 sm:mb-3">
            <h2 className="text-sm font-semibold text-ink">
              How would you like to share feedback?
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Use any combination. Everything you fill in is sent together.
            </p>
          </div>
          <Tabs
            activeKey={activeKey}
            onChange={onTabChange}
            size="large"
            items={[
              {
                key: 'audio',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Microphone size={14} weight="fill" /> Audio
                  </span>
                ),
                children: (
                  <AudioTab
                    audio={audio}
                    durationSec={audioDurationSec}
                    onChange={(nextAudio, nextDuration) => {
                      setAudio(nextAudio);
                      setAudioDurationSec(nextDuration);
                    }}
                  />
                ),
              },
              {
                key: 'image',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <ImageSquare size={14} weight="fill" /> Image
                  </span>
                ),
                children: <ImageTab images={images} onChange={setImages} />,
              },
              {
                key: 'text',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <TextAa size={14} weight="bold" /> Text
                  </span>
                ),
                children: <TextTab value={text} onChange={setText} />,
              },
            ]}
          />
        </section>

        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:border sm:bg-sidebar sm:px-5 sm:py-4">
          <p className="text-[11px] text-ink-muted">
            {hasContent
              ? 'Ready when you are — you can add more before you submit.'
              : 'Add at least one piece of feedback to enable Submit.'}
          </p>
          <Button
            type="primary"
            size="large"
            icon={<PaperPlaneTilt size={16} weight="fill" />}
            disabled={!hasContent || submitState === 'submitting'}
            loading={submitState === 'submitting'}
            onClick={handleSubmit}
            className="sm:min-w-48"
          >
            Submit evaluation
          </Button>
        </div>
      </div>
    </div>
  );
}
