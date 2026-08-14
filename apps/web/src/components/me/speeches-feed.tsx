import {
  CaretDown,
  ChatCircleDots,
  ChatCircleText,
  Microphone,
  SpeakerHigh,
  Timer,
} from '@phosphor-icons/react/dist/ssr';
import { useState } from 'react';
import { StaggerList } from '@/components/motion/stagger-list';
import type { Evaluation } from '@/lib/education/evaluations';
import type { HistoryEvent } from '@/lib/education/history';
import type { Member } from '@/lib/education/members';
import type { EvaluationSubmissionWire } from '@/lib/evaluation/api-types';
import type { AhCounterEntry } from '@/lib/meetings/ah-counter-reports';
import { totalFillers } from '@/lib/meetings/ah-counter-reports';
import type { TimerEntry, TimerVerdict } from '@/lib/meetings/timer-reports';
import { deriveTimerVerdict, formatSeconds } from '@/lib/meetings/timer-reports';

import { ImagePreview, SubmissionCard } from './evaluation-submission-card';

type SpeechEvent = Extract<HistoryEvent, { type: 'speech-given' }>;

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const VERDICT_STYLE: Record<TimerVerdict, { label: string; className: string }> = {
  under: { label: 'Under time', className: 'bg-amber-100 text-amber-800' },
  within: { label: 'Within time', className: 'bg-emerald-100 text-emerald-800' },
  over: { label: 'Over time', className: 'bg-rose-100 text-rose-800' },
};

function ReportBlock({
  Icon,
  label,
  children,
}: {
  Icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'bold'; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-fill/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        <Icon size={12} weight="bold" />
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Pending({ text }: { text: string }) {
  return <p className="text-xs text-ink-muted italic">{text}</p>;
}

/** Collapsible group of the audio/image/text feedback an evaluator sent
 * through the public evaluation link, for this one speech. Starts closed —
 * a speech with several submissions shouldn't dump all that media into view
 * until the member asks for it. */
function FeedbackAccordion({
  submissions,
  onOpenImage,
}: {
  submissions: EvaluationSubmissionWire[];
  onOpenImage: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (submissions.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-line bg-fill/40">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        aria-expanded={expanded}
      >
        <ChatCircleDots size={14} weight="bold" className="shrink-0 text-ink-soft" />
        <span className="flex-1 text-xs font-semibold text-ink">
          Peer feedback
          <span className="ml-1.5 rounded-full bg-fill px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
            {submissions.length}
          </span>
        </span>
        <CaretDown
          size={12}
          weight="bold"
          className={`shrink-0 text-ink-muted transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
      </button>
      {expanded ? (
        <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
          {submissions.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} onOpenImage={onOpenImage} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface SpeechCardProps {
  speech: SpeechEvent;
  evaluation?: Evaluation;
  timerEntry?: TimerEntry;
  ahCounterEntry?: AhCounterEntry;
  evaluator?: Member;
  submissions: EvaluationSubmissionWire[];
  onOpenImage: (url: string) => void;
}

function SpeechCard({
  speech,
  evaluation,
  timerEntry,
  ahCounterEntry,
  evaluator,
  submissions,
  onOpenImage,
}: SpeechCardProps) {
  const verdict = timerEntry ? VERDICT_STYLE[deriveTimerVerdict(timerEntry)] : null;

  return (
    <article className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <Microphone size={18} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">&ldquo;{speech.title}&rdquo;</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Meeting #{speech.meetingNumber} · {formatDate(speech.date)}
            {speech.projectName ? ` · ${speech.projectName}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReportBlock Icon={ChatCircleText} label="Evaluation">
          {evaluation ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-ink">
                By {evaluator ? `${evaluator.firstName} ${evaluator.lastName}` : 'a club evaluator'}
              </p>
              <p className="text-xs text-ink-soft">{evaluation.strengths}</p>
              <p className="text-xs text-ink-muted">{evaluation.improvement}</p>
            </div>
          ) : (
            <Pending text="Awaiting evaluation" />
          )}
        </ReportBlock>

        <ReportBlock Icon={Timer} label="Timer report">
          {timerEntry && verdict ? (
            <div>
              <p className="text-lg font-semibold leading-none text-ink">
                {formatSeconds(timerEntry.actualSeconds)}
              </p>
              <span
                className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${verdict.className}`}
              >
                {verdict.label}
              </span>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Target {timerEntry.targetMinMinutes}–{timerEntry.targetMaxMinutes} min
              </p>
            </div>
          ) : (
            <Pending text="Not yet timed" />
          )}
        </ReportBlock>

        <ReportBlock Icon={SpeakerHigh} label="Ah-Counter report">
          {ahCounterEntry ? (
            <div>
              <p className="text-lg font-semibold leading-none text-ink">
                {totalFillers(ahCounterEntry)}
                <span className="ml-1 text-xs font-normal text-ink-muted">fillers</span>
              </p>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                {Object.entries(ahCounterEntry.fillerCounts)
                  .map(([word, count]) => `${word} ${count}`)
                  .join(' · ')}
              </p>
            </div>
          ) : (
            <Pending text="Not yet counted" />
          )}
        </ReportBlock>
      </div>

      <FeedbackAccordion submissions={submissions} onOpenImage={onOpenImage} />
    </article>
  );
}

interface SpeechesFeedProps {
  speeches: SpeechEvent[];
  evaluations: Evaluation[];
  timerEntries: TimerEntry[];
  ahCounterEntries: AhCounterEntry[];
  membersById: Map<string, Member>;
  submissions: EvaluationSubmissionWire[];
}

/** The Toastmasters-specific "activity feed": one card per prepared speech,
 * each carrying the three reports it collects plus any public evaluation
 * feedback received for it. Everything joins back to the speech's history
 * event by `speechEventId` rather than duplicating the speech's own fields
 * onto each report; feedback joins by `meetingSpeakerId` instead, since it's
 * submitted against the underlying `MeetingSpeaker` slot, not the event. */
export function SpeechesFeed({
  speeches,
  evaluations,
  timerEntries,
  ahCounterEntries,
  membersById,
  submissions,
}: SpeechesFeedProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  if (speeches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-canvas px-6 py-12 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <Microphone size={20} weight="bold" />
        </span>
        <h2 className="text-sm font-semibold text-ink">No speeches yet</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-xs text-ink-soft">
          Once you deliver your first prepared speech, its evaluation, timer and Ah-Counter reports
          will show up here.
        </p>
      </div>
    );
  }

  const evaluationByEvent = new Map(evaluations.map((entry) => [entry.speechEventId, entry]));
  const timerByEvent = new Map(timerEntries.map((entry) => [entry.speechEventId, entry]));
  const ahCounterByEvent = new Map(ahCounterEntries.map((entry) => [entry.speechEventId, entry]));

  const submissionsBySpeaker = new Map<string, EvaluationSubmissionWire[]>();
  for (const submission of submissions) {
    const list = submissionsBySpeaker.get(submission.meetingSpeakerId);
    if (list) list.push(submission);
    else submissionsBySpeaker.set(submission.meetingSpeakerId, [submission]);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink">My speeches</h2>
      <StaggerList className="flex flex-col gap-4">
        {speeches.map((speech) => {
          const evaluation = evaluationByEvent.get(speech.id);
          const speechSubmissions = speech.meetingSpeakerId
            ? (submissionsBySpeaker.get(speech.meetingSpeakerId) ?? [])
            : [];
          return (
            <SpeechCard
              key={speech.id}
              speech={speech}
              evaluation={evaluation}
              timerEntry={timerByEvent.get(speech.id)}
              ahCounterEntry={ahCounterByEvent.get(speech.id)}
              evaluator={evaluation ? membersById.get(evaluation.evaluatorId) : undefined}
              submissions={speechSubmissions}
              onOpenImage={setPreviewSrc}
            />
          );
        })}
      </StaggerList>

      <ImagePreview src={previewSrc} onClose={() => setPreviewSrc(null)} />
    </div>
  );
}
