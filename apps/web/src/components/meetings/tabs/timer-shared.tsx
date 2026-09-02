'use client';

import {
  ArrowCounterClockwise,
  DotsThreeVertical,
  PencilSimple,
  Play,
  Stop,
  TrashSimple,
} from '@phosphor-icons/react/dist/ssr';
import type { InputRef } from 'antd';
import { Button, Dropdown, Input } from 'antd';
import { useEffect, useRef } from 'react';

import type { Member } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';
import type { Bracket, TimerSpeaker, TimerSpeakerType } from '@/lib/meetings/role-state';

export const TYPE_BRACKETS: Record<TimerSpeakerType, Bracket> = {
  'Prepared Speaker': { green: 5 * 60, yellow: 6 * 60, red: 7 * 60 },
  'Ice Breaker': { green: 4 * 60, yellow: 5 * 60, red: 6 * 60 },
  'Table Topic': { green: 60, yellow: 90, red: 2 * 60 },
  'Speech Evaluator': { green: 2 * 60, yellow: 150, red: 3 * 60 },
  'TT Evaluator': { green: 2 * 60, yellow: 150, red: 3 * 60 },
  'General Evaluator': { green: 5 * 60, yellow: 6 * 60, red: 7 * 60 },
};

/** A prepared speaker's own bracket, once "Take from agenda" derives it from
 * the project's timed range — green/red at the bounds, yellow at the
 * midpoint, matching the proportions of the hardcoded defaults above. */
export function bracketFromDuration(bounds: { min: number; max: number }): Bracket {
  const green = bounds.min * 60;
  const red = bounds.max * 60;
  return { green, yellow: Math.round((green + red) / 2), red };
}

/** Resolves an `AssigneeSelect` pick into the speaker draft this tab stores —
 * a member arrives with only its id, so the display name is looked up here;
 * a guest already carries its own resolved name. */
export function assigneeToDraft(
  assignee: Assignee,
  members: Member[],
): { memberId?: string; guestId?: string; name: string } {
  if (assignee.kind === 'member') {
    const member = members.find((m) => m.id === assignee.memberId);
    return {
      memberId: assignee.memberId,
      name: member ? `${member.firstName} ${member.lastName}` : 'Unknown member',
    };
  }
  return { guestId: assignee.guestId, name: assignee.name };
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

export function formatShortTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export type BracketColor = 'default' | 'green' | 'yellow' | 'red';

export function currentBracketColor(elapsed: number, brackets: Bracket): BracketColor {
  if (elapsed >= brackets.red) return 'red';
  if (elapsed >= brackets.yellow) return 'yellow';
  if (elapsed >= brackets.green) return 'green';
  return 'default';
}

/** Rank ordering so a bracket-escalation check is a numeric compare. */
export const BRACKET_RANK: Record<BracketColor, number> = {
  default: 0,
  green: 1,
  yellow: 2,
  red: 3,
};

/** Distinct vibration pattern per bracket, fired the moment a running
 * speaker's clock crosses into green/yellow/red — the timer keeper is
 * usually watching the speaker, not the screen, so thresholds must be
 * distinguishable by feel alone: one long pulse at green, two at yellow,
 * and a triple pulse stretching over ~3s at red. */
const BRACKET_VIBRATION: Record<Exclude<BracketColor, 'default'>, VibratePattern> = {
  green: 1000,
  yellow: [700, 200, 700],
  red: [800, 250, 800, 250, 800],
};

/** Vibrates the device with the bracket's pattern. Silent no-op where the
 * Vibration API is unavailable (desktop browsers, iOS Safari) or where the
 * page hasn't seen a user gesture yet — Chrome gates `vibrate` behind
 * sticky activation, always satisfied here since starting a timer is a
 * tap. */
export function vibrateBracket(color: BracketColor): void {
  if (color === 'default') return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  navigator.vibrate(BRACKET_VIBRATION[color]);
}

export function computeElapsed(speaker: TimerSpeaker, now: number): number {
  if (speaker.status === 'running' && speaker.startedAt !== undefined) {
    return speaker.elapsed + Math.max(0, (now - speaker.startedAt) / 1000);
  }
  return speaker.elapsed;
}

interface BracketCardProps {
  label: string;
  seconds: number;
  color: 'green' | 'yellow' | 'red';
  active: boolean;
}

function BracketCard({ label, seconds, color, active }: BracketCardProps) {
  const styles = {
    green: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      text: 'text-emerald-700',
      ring: 'ring-emerald-400',
    },
    yellow: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      text: 'text-amber-700',
      ring: 'ring-amber-400',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-100',
      text: 'text-red-700',
      ring: 'ring-red-400',
    },
  }[color];

  return (
    <div
      className={`rounded-xl border py-2.5 text-center transition-shadow ${styles.bg} ${styles.border} ${
        active ? `ring-2 ${styles.ring}` : ''
      }`}
    >
      <div className={`text-[10px] font-semibold uppercase tracking-widest ${styles.text}`}>
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${styles.text}`}>
        {formatShortTime(seconds)}
      </div>
    </div>
  );
}

export interface TimerCardProps {
  speaker: TimerSpeaker;
  elapsed: number;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

export function TimerCard({ speaker, elapsed, onStart, onStop, onReset }: TimerCardProps) {
  const brackets = speaker.brackets ?? TYPE_BRACKETS[speaker.type];
  const bracketColor = currentBracketColor(elapsed, brackets);
  const running = speaker.status === 'running';

  const timerColorClass =
    bracketColor === 'red'
      ? 'text-red-600'
      : bracketColor === 'yellow'
        ? 'text-amber-500'
        : bracketColor === 'green'
          ? 'text-emerald-600'
          : 'text-ink';

  return (
    <article className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
      <div className="mb-4">
        <span className="inline-flex items-center rounded-full bg-fill px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
          {speaker.type}
        </span>
        <h3 className="mt-2 text-lg font-semibold text-ink">{speaker.name}</h3>
      </div>

      <div
        className={`text-center font-mono text-7xl font-bold leading-none tabular-nums sm:text-8xl ${timerColorClass}`}
      >
        {formatTime(elapsed)}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        <BracketCard
          label="Green"
          seconds={brackets.green}
          color="green"
          active={bracketColor === 'green'}
        />
        <BracketCard
          label="Yellow"
          seconds={brackets.yellow}
          color="yellow"
          active={bracketColor === 'yellow'}
        />
        <BracketCard
          label="Red"
          seconds={brackets.red}
          color="red"
          active={bracketColor === 'red'}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Button
          type="primary"
          size="large"
          block
          icon={<Play size={16} weight="fill" />}
          onClick={onStart}
          disabled={running}
        >
          Start
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="large"
            icon={<Stop size={16} weight="fill" />}
            onClick={onStop}
            disabled={!running}
          >
            Stop
          </Button>
          <Button
            size="large"
            icon={<ArrowCounterClockwise size={16} weight="bold" />}
            onClick={onReset}
            disabled={elapsed === 0 && speaker.status === 'idle'}
          >
            Reset
          </Button>
        </div>
      </div>
    </article>
  );
}

export interface SpeakerListRowProps {
  speaker: TimerSpeaker;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  /** Live clock — only the mobile list passes this, so a running speaker's
   * row shows its elapsed time ticking. Desktop omits it: its TimerCard is
   * always on screen, so a second clock in the row would be noise. */
  now?: number;
  /** Subtle background tint identifying the speaker-type group — the mobile
   * list groups by type without headers, so color does the grouping.
   * Desktop omits it (flat white rows). */
  tintClass?: string;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onEditingNameChange: (name: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
}

export function SpeakerListRow({
  speaker,
  isActive,
  isEditing,
  editingName,
  now,
  tintClass,
  onSelect,
  onRename,
  onDelete,
  onEditingNameChange,
  onSaveRename,
  onCancelRename,
}: SpeakerListRowProps) {
  const editRef = useRef<InputRef>(null);
  const doneTime = speaker.status === 'done' ? formatShortTime(speaker.elapsed) : null;
  const runningTime =
    speaker.status === 'running' && now !== undefined
      ? formatShortTime(computeElapsed(speaker, now))
      : null;

  useEffect(() => {
    if (isEditing) editRef.current?.focus({ cursor: 'end' });
  }, [isEditing]);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
        isActive
          ? 'border-line-strong bg-fill'
          : `border-line ${tintClass ?? 'bg-canvas'} hover:bg-fill/60`
      }`}
    >
      {isEditing ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            ref={editRef}
            size="middle"
            value={editingName}
            onChange={(event) => onEditingNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSaveRename();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onCancelRename();
              }
            }}
            maxLength={80}
          />
          <Button size="small" onClick={onCancelRename}>
            Cancel
          </Button>
          <Button
            size="small"
            type="primary"
            onClick={onSaveRename}
            disabled={editingName.trim().length === 0}
          >
            Save
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          aria-current={isActive ? 'true' : undefined}
          className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <div className="truncate text-sm font-semibold text-ink">{speaker.name}</div>
          <div className="text-xs text-ink-muted">{speaker.type}</div>
        </button>
      )}

      {!isEditing && (doneTime || runningTime) ? (
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-semibold tabular-nums text-ink">
            {doneTime ?? runningTime}
          </div>
          <div
            className={`text-[11px] ${doneTime ? 'text-ink-muted' : 'font-medium text-emerald-600'}`}
          >
            {doneTime ? 'Done' : 'Running'}
          </div>
        </div>
      ) : null}

      {!isEditing ? (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'rename', icon: <PencilSimple size={14} />, label: 'Rename' },
              {
                key: 'delete',
                icon: <TrashSimple size={14} />,
                label: 'Delete',
                danger: true,
              },
            ],
            onClick: ({ key }) => {
              if (key === 'rename') onRename();
              else if (key === 'delete') onDelete();
            },
          }}
        >
          <button
            type="button"
            aria-label={`More options for ${speaker.name}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>
        </Dropdown>
      ) : null}
    </div>
  );
}
