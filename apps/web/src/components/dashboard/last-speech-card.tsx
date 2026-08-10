import { ChatCircleText, Microphone, SpeakerHigh, Timer } from '@phosphor-icons/react/dist/ssr';

import type { Evaluation } from '@/lib/education/evaluations';
import type { HistoryEvent } from '@/lib/education/history';
import type { Member } from '@/lib/education/members';
import type { AhCounterEntry } from '@/lib/meetings/ah-counter-reports';
import { totalFillers } from '@/lib/meetings/ah-counter-reports';
import type { TimerEntry, TimerVerdict } from '@/lib/meetings/timer-reports';
import { deriveTimerVerdict, formatSeconds } from '@/lib/meetings/timer-reports';

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
  return <p className="text-xs italic text-ink-muted">{text}</p>;
}

interface LastSpeechCardProps {
  speech: SpeechEvent | null;
  evaluation?: Evaluation;
  timerEntry?: TimerEntry;
  ahCounterEntry?: AhCounterEntry;
  evaluator?: Member;
}

/** "How did my last speech go" — the three reports (evaluation, timing,
 * Ah-Counter) for the most recent prepared speech, at a glance rather than
 * buried in the full history feed on the Me page. */
export function LastSpeechCard({
  speech,
  evaluation,
  timerEntry,
  ahCounterEntry,
  evaluator,
}: LastSpeechCardProps) {
  if (!speech) {
    return (
      <article className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-canvas px-5 py-8 text-center">
        <span
          aria-hidden
          className="mb-3 flex size-11 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <Microphone size={20} weight="bold" />
        </span>
        <h2 className="text-sm font-semibold text-ink">No speeches yet</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-xs text-ink-soft">
          Once you deliver your first prepared speech, its reports will show up here.
        </p>
      </article>
    );
  }

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
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Your last speech
          </h2>
          <h3 className="mt-0.5 text-sm font-semibold text-ink">&ldquo;{speech.title}&rdquo;</h3>
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
              <p className="line-clamp-3 text-xs text-ink-soft">{evaluation.strengths}</p>
            </div>
          ) : (
            <Pending text="Awaiting evaluation" />
          )}
        </ReportBlock>

        <ReportBlock Icon={Timer} label="Timing">
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
            </div>
          ) : (
            <Pending text="Not yet timed" />
          )}
        </ReportBlock>

        <ReportBlock Icon={SpeakerHigh} label="Ah-Counter">
          {ahCounterEntry ? (
            <div>
              <p className="text-lg font-semibold leading-none text-ink">
                {totalFillers(ahCounterEntry)}
                <span className="ml-1 text-xs font-normal text-ink-muted">fillers</span>
              </p>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                {Object.entries(ahCounterEntry.fillerCounts)
                  .filter(([, count]) => count > 0)
                  .map(([word, count]) => `${word} ${count}`)
                  .join(' · ') || 'None counted'}
              </p>
            </div>
          ) : (
            <Pending text="Not yet counted" />
          )}
        </ReportBlock>
      </div>
    </article>
  );
}
