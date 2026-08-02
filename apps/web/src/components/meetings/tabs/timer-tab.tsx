'use client';

import {
  ArrowCounterClockwise,
  DotsThreeVertical,
  PencilSimple,
  Play,
  Stop,
  TrashSimple,
  X,
} from '@phosphor-icons/react/dist/ssr';
import type { InputRef } from 'antd';
import { AutoComplete, Button, Dropdown, Input, Select, Tabs } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useGetMembersQuery } from '@/store/api';

const SPEAKER_TYPES = [
  'Prepared Speaker',
  'Ice Breaker',
  'Table Topic',
  'Speech Evaluator',
  'TT Evaluator',
  'General Evaluator',
] as const;
type SpeakerType = (typeof SPEAKER_TYPES)[number];

interface Bracket {
  green: number;
  yellow: number;
  red: number;
}

/** Standard Toastmasters timing brackets in seconds. Table Topic and the
 * evaluator slots run short; prepared/general slots get the full window. */
const TYPE_BRACKETS: Record<SpeakerType, Bracket> = {
  'Prepared Speaker': { green: 5 * 60, yellow: 6 * 60, red: 7 * 60 },
  'Ice Breaker': { green: 4 * 60, yellow: 5 * 60, red: 6 * 60 },
  'Table Topic': { green: 60, yellow: 90, red: 2 * 60 },
  'Speech Evaluator': { green: 2 * 60, yellow: 150, red: 3 * 60 },
  'TT Evaluator': { green: 2 * 60, yellow: 150, red: 3 * 60 },
  'General Evaluator': { green: 5 * 60, yellow: 6 * 60, red: 7 * 60 },
};

type TimerStatus = 'idle' | 'running' | 'done';

interface TimerSpeaker {
  id: string;
  memberId?: string;
  name: string;
  type: SpeakerType;
  status: TimerStatus;
  /** Committed elapsed seconds — what we render for stopped speakers and the
   * base value for a resumed timer. */
  elapsed: number;
  /** Wall-clock ms at the last Start. Undefined unless status === 'running'. */
  startedAt?: number;
}

interface MemberOption {
  value: string;
  label: string;
}

/** Zero-padded MM:SS, used in the large countdown display. */
function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

/** Un-padded M:SS, matches the bracket chips and the list-row time column. */
function formatShortTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

type TimingResult = 'Under time' | 'In time' | 'Over time';

/** Toastmasters convention: a speech qualifies if it lands between the green
 * signal and 30 seconds past the red. Under / over that window disqualifies
 * the speaker from the evaluation ballot. */
function classifyResult(elapsed: number, brackets: Bracket): TimingResult {
  if (elapsed < brackets.green) return 'Under time';
  if (elapsed <= brackets.red + 30) return 'In time';
  return 'Over time';
}

type BracketColor = 'default' | 'green' | 'yellow' | 'red';

function currentBracketColor(elapsed: number, brackets: Bracket): BracketColor {
  if (elapsed >= brackets.red) return 'red';
  if (elapsed >= brackets.yellow) return 'yellow';
  if (elapsed >= brackets.green) return 'green';
  return 'default';
}

function computeElapsed(speaker: TimerSpeaker, now: number): number {
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

/** Bracket chip — three of them sit under the timer to show the green /
 * yellow / red thresholds for the current speaker type. The chip lights up
 * with a ring when the elapsed time crosses into its window. */
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

interface TimerCardProps {
  speaker: TimerSpeaker;
  elapsed: number;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

function TimerCard({ speaker, elapsed, onStart, onStop, onReset }: TimerCardProps) {
  const brackets = TYPE_BRACKETS[speaker.type];
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

interface AddSpeakerFormProps {
  memberOptions: MemberOption[];
  onCommit: (draft: { memberId?: string; name: string; type: SpeakerType }) => void;
  onCancel: () => void;
}

function AddSpeakerForm({ memberOptions, onCommit, onCancel }: AddSpeakerFormProps) {
  const [type, setType] = useState<SpeakerType>('Prepared Speaker');
  const [draftName, setDraftName] = useState('');

  function commit() {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    const matched = memberOptions.find(
      (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (matched) onCommit({ memberId: matched.value, name: matched.label, type });
    else onCommit({ name: trimmed, type });
    setDraftName('');
  }

  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-sidebar p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          size="large"
          className="sm:w-52"
          value={type}
          onChange={(value: SpeakerType) => setType(value)}
          options={SPEAKER_TYPES.map((entry) => ({ value: entry, label: entry }))}
        />
        <AutoComplete
          className="min-w-0 flex-1"
          size="large"
          value={draftName}
          onChange={(value) => setDraftName(value)}
          onSelect={(value: string) => {
            setDraftName(value);
            commitWith(value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
          options={memberOptions.map((option) => ({ value: option.label }))}
          filterOption={(input, option) =>
            String(option?.value ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
          defaultActiveFirstOption={false}
          placeholder="Search or type a name…"
          autoFocus
        />
        <div className="flex items-center gap-2 sm:shrink-0">
          <Button type="primary" onClick={commit} disabled={!draftName.trim()}>
            Add
          </Button>
          <Button
            type="text"
            aria-label="Cancel adding speaker"
            icon={<X size={16} className="text-ink-muted" />}
            onClick={onCancel}
          />
        </div>
      </div>
    </div>
  );

  /* Inner helper — needed only so `onSelect` can commit with the just-picked
   * option label without waiting for state to settle. */
  function commitWith(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const matched = memberOptions.find(
      (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (matched) onCommit({ memberId: matched.value, name: matched.label, type });
    else onCommit({ name: trimmed, type });
    setDraftName('');
  }
}

interface SpeakerListRowProps {
  speaker: TimerSpeaker;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onEditingNameChange: (name: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
}

function SpeakerListRow({
  speaker,
  isActive,
  isEditing,
  editingName,
  onSelect,
  onRename,
  onDelete,
  onEditingNameChange,
  onSaveRename,
  onCancelRename,
}: SpeakerListRowProps) {
  const editRef = useRef<InputRef>(null);
  const doneTime = speaker.status === 'done' ? formatShortTime(speaker.elapsed) : null;

  useEffect(() => {
    if (isEditing) editRef.current?.focus({ cursor: 'end' });
  }, [isEditing]);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
        isActive ? 'border-line-strong bg-fill' : 'border-line bg-canvas hover:bg-fill/60'
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

      {!isEditing && doneTime ? (
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-semibold tabular-nums text-ink">{doneTime}</div>
          <div className="text-[11px] text-ink-muted">Done</div>
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

interface SpeakerViewProps {
  speakers: TimerSpeaker[];
  activeId: string | null;
  now: number;
  memberOptions: MemberOption[];
  adding: boolean;
  editingId: string | null;
  editingName: string;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAdd: (draft: { memberId?: string; name: string; type: SpeakerType }) => void;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onEditingNameChange: (name: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

function SpeakerView({
  speakers,
  activeId,
  now,
  memberOptions,
  adding,
  editingId,
  editingName,
  onStartAdd,
  onCancelAdd,
  onAdd,
  onSelect,
  onRename,
  onDelete,
  onEditingNameChange,
  onSaveRename,
  onCancelRename,
  onStart,
  onStop,
  onReset,
}: SpeakerViewProps) {
  const active = speakers.find((speaker) => speaker.id === activeId) ?? null;
  const elapsed = active ? computeElapsed(active, now) : 0;

  return (
    <div className="flex flex-col gap-4">
      {active ? (
        <TimerCard
          speaker={active}
          elapsed={elapsed}
          onStart={onStart}
          onStop={onStop}
          onReset={onReset}
        />
      ) : null}

      {adding ? (
        <AddSpeakerForm memberOptions={memberOptions} onCommit={onAdd} onCancel={onCancelAdd} />
      ) : (
        <Button
          block
          size="large"
          type="dashed"
          icon={<Play size={14} weight="fill" className="rotate-90" />}
          onClick={onStartAdd}
        >
          + Add Speaker
        </Button>
      )}

      {speakers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">No speakers yet</p>
          <p className="mt-1 text-xs text-ink-muted">
            Use &ldquo;Add Speaker&rdquo; to add the first speaker to time.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {speakers.map((speaker) => (
            <SpeakerListRow
              key={speaker.id}
              speaker={speaker}
              isActive={speaker.id === activeId}
              isEditing={speaker.id === editingId}
              editingName={editingName}
              onSelect={() => onSelect(speaker.id)}
              onRename={() => onRename(speaker.id)}
              onDelete={() => onDelete(speaker.id)}
              onEditingNameChange={onEditingNameChange}
              onSaveRename={onSaveRename}
              onCancelRename={onCancelRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const RESULT_COLORS: Record<TimingResult, string> = {
  'Under time': 'text-red-600',
  'In time': 'text-emerald-700',
  'Over time': 'text-red-600',
};

function ReportView({ speakers }: { speakers: TimerSpeaker[] }) {
  const done = speakers.filter((speaker) => speaker.status === 'done');

  if (done.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
        <p className="text-sm font-medium text-ink">No results yet</p>
        <p className="mt-1 text-xs text-ink-muted">
          Timing a speaker to completion adds them here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
      <div className="border-b border-line px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
          Session Report
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-medium text-ink-muted">
              <th className="sticky left-0 z-10 bg-canvas px-4 py-3 text-left">Speaker</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Time</th>
              <th className="px-4 py-3 text-right">Result</th>
            </tr>
          </thead>
          <tbody>
            {done.map((speaker) => {
              const brackets = TYPE_BRACKETS[speaker.type];
              const result = classifyResult(speaker.elapsed, brackets);
              return (
                <tr key={speaker.id} className="border-b border-line last:border-b-0">
                  <td className="sticky left-0 z-10 bg-canvas px-4 py-3 font-medium text-ink">
                    {speaker.name}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{speaker.type}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-ink">
                    {formatShortTime(speaker.elapsed)}
                  </td>
                  <td className={`px-4 py-3 text-right ${RESULT_COLORS[result]}`}>{result}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Timer tab — two sub-tabs sharing the same state. Speaker holds the active
 * timer card, the add form, and the ordered list of speakers with rename /
 * delete actions. Report reflects everyone who has been timed to completion
 * with their result classification. State is local for now. */
export function TimerTab() {
  const { data: members } = useGetMembersQuery();
  const [speakers, setSpeakers] = useState<TimerSpeaker[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  /* `now` drives the live timer display. Initialized to 0 so the first server
   * render is deterministic; a useEffect populates the real value on mount so
   * a running timer starts ticking as soon as it's the active one. */
  const [now, setNow] = useState(0);

  const memberOptions = useMemo<MemberOption[]>(
    () =>
      (members ?? [])
        .map((member) => ({
          value: member.id,
          label: `${member.firstName} ${member.lastName}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [members],
  );

  const activeSpeaker = speakers.find((speaker) => speaker.id === activeId) ?? null;
  const isRunning = activeSpeaker?.status === 'running';

  /* Only tick while the active speaker is running — the interval unmounts as
   * soon as the timer stops, so an idle tab isn't paying for a re-render 4×
   * per second forever. `computeElapsed` clamps to 0 when `now` is behind
   * `startedAt`, so the first 250ms after Start shows 00:00 rather than a
   * negative jump — no need to seed `now` from the effect body. */
  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isRunning, activeId]);

  function handleAdd(draft: { memberId?: string; name: string; type: SpeakerType }) {
    const id = crypto.randomUUID();
    setSpeakers((prev) => [
      ...prev,
      {
        id,
        memberId: draft.memberId,
        name: draft.name,
        type: draft.type,
        status: 'idle',
        elapsed: 0,
      },
    ]);
    /* New speakers auto-select — the timer card jumps to them so the user can
     * hit Start immediately without a follow-up tap. */
    setActiveId(id);
    setAdding(false);
  }

  function handleDelete(id: string) {
    setSpeakers((prev) => prev.filter((speaker) => speaker.id !== id));
    if (activeId === id) setActiveId(null);
    if (editingId === id) {
      setEditingId(null);
      setEditingName('');
    }
  }

  function handleSelect(id: string) {
    setActiveId(id);
  }

  function handleStart() {
    if (!activeId) return;
    const startedAt = Date.now();
    setSpeakers((prev) =>
      prev.map((speaker) => {
        if (speaker.id === activeId) {
          return { ...speaker, status: 'running', startedAt };
        }
        /* Any other running timer commits to `done` — one speaker can be on
         * the clock at a time, no phantom counters in the background. */
        if (speaker.status === 'running' && speaker.startedAt !== undefined) {
          const nextElapsed = speaker.elapsed + (startedAt - speaker.startedAt) / 1000;
          return {
            ...speaker,
            status: 'done',
            elapsed: nextElapsed,
            startedAt: undefined,
          };
        }
        return speaker;
      }),
    );
  }

  function handleStop() {
    if (!activeId) return;
    const stoppedAt = Date.now();
    setSpeakers((prev) =>
      prev.map((speaker) => {
        if (speaker.id !== activeId) return speaker;
        if (speaker.status !== 'running' || speaker.startedAt === undefined) return speaker;
        const nextElapsed = speaker.elapsed + (stoppedAt - speaker.startedAt) / 1000;
        return { ...speaker, status: 'done', elapsed: nextElapsed, startedAt: undefined };
      }),
    );
  }

  function handleReset() {
    if (!activeId) return;
    setSpeakers((prev) =>
      prev.map((speaker) =>
        speaker.id === activeId
          ? { ...speaker, status: 'idle', elapsed: 0, startedAt: undefined }
          : speaker,
      ),
    );
  }

  function handleRename(id: string) {
    const target = speakers.find((speaker) => speaker.id === id);
    if (!target) return;
    setEditingId(id);
    setEditingName(target.name);
  }

  function handleSaveRename() {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;
    setSpeakers((prev) =>
      prev.map((speaker) => (speaker.id === editingId ? { ...speaker, name: trimmed } : speaker)),
    );
    setEditingId(null);
    setEditingName('');
  }

  function handleCancelRename() {
    setEditingId(null);
    setEditingName('');
  }

  return (
    <section className="mx-auto max-w-4xl">
      <Tabs
        defaultActiveKey="speaker"
        size="middle"
        items={[
          {
            key: 'speaker',
            label: 'Speaker',
            children: (
              <SpeakerView
                speakers={speakers}
                activeId={activeId}
                now={now}
                memberOptions={memberOptions}
                adding={adding}
                editingId={editingId}
                editingName={editingName}
                onStartAdd={() => setAdding(true)}
                onCancelAdd={() => setAdding(false)}
                onAdd={handleAdd}
                onSelect={handleSelect}
                onRename={handleRename}
                onDelete={handleDelete}
                onEditingNameChange={setEditingName}
                onSaveRename={handleSaveRename}
                onCancelRename={handleCancelRename}
                onStart={handleStart}
                onStop={handleStop}
                onReset={handleReset}
              />
            ),
          },
          {
            key: 'report',
            label: 'Report',
            children: <ReportView speakers={speakers} />,
          },
        ]}
      />
    </section>
  );
}
