'use client';

import {
  ArrowCounterClockwise,
  ClipboardText,
  DotsThreeVertical,
  PencilSimple,
  Play,
  Stop,
  TrashSimple,
  X,
} from '@phosphor-icons/react/dist/ssr';
import type { InputRef } from 'antd';
import { Button, Dropdown, Input, Select, Tabs } from 'antd';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import { ShareRoleButton } from '@/components/meetings/tabs/share-role-button';
import type { Member } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';
import {
  buildAgendaSpeakerSources,
  fromPublicAgendaSpeakerSources,
} from '@/lib/meetings/agenda-speaker-sources';
import {
  type Bracket,
  parseRoleState,
  readRoleStateRaw,
  subscribeToRoleState,
  TIMER_SPEAKER_TYPES,
  type TimerSpeaker,
  type TimerSpeakerType,
  updateRoleState,
} from '@/lib/meetings/role-state';
import type { Guest } from '@/lib/people/guests';
import { usePersistentTab } from '@/lib/ui/use-persistent-tab';
import {
  useGetGuestsQuery,
  useGetMeetingRolesQuery,
  useGetMembersQuery,
  useGetPreparedSpeakersQuery,
  useGetPublicAgendaSpeakerSourcesQuery,
} from '@/store/api';

const TYPE_BRACKETS: Record<TimerSpeakerType, Bracket> = {
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
function bracketFromDuration(bounds: { min: number; max: number }): Bracket {
  const green = bounds.min * 60;
  const red = bounds.max * 60;
  return { green, yellow: Math.round((green + red) / 2), red };
}

/** Resolves an `AssigneeSelect` pick into the speaker draft this tab stores —
 * a member arrives with only its id, so the display name is looked up here;
 * a guest already carries its own resolved name. */
function assigneeToDraft(
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

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

function formatShortTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

type TimingResult = 'Under time' | 'In time' | 'Over time';

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

interface AddSpeakerFormProps {
  members: Member[];
  guests: Guest[];
  onCommit: (draft: {
    memberId?: string;
    guestId?: string;
    name: string;
    type: TimerSpeakerType;
  }) => void;
  onCancel: () => void;
}

function AddSpeakerForm({ members, guests, onCommit, onCancel }: AddSpeakerFormProps) {
  const [type, setType] = useState<TimerSpeakerType>('Prepared Speaker');
  const [pending, setPending] = useState<Assignee | null>(null);

  function commit() {
    if (!pending) return;
    onCommit({ ...assigneeToDraft(pending, members), type });
    setPending(null);
  }

  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-sidebar p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          size="large"
          className="sm:w-52"
          value={type}
          onChange={(value: TimerSpeakerType) => setType(value)}
          options={TIMER_SPEAKER_TYPES.map((entry) => ({ value: entry, label: entry }))}
        />
        <div className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2">
          <AssigneeSelect
            value={pending}
            onChange={setPending}
            members={members}
            guests={guests}
            placeholder="Search or type a name…"
            ariaLabel="Speaker"
          />
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <Button type="primary" onClick={commit} disabled={!pending}>
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
  members: Member[];
  guests: Guest[];
  adding: boolean;
  editingId: string | null;
  editingName: string;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAdd: (draft: {
    memberId?: string;
    guestId?: string;
    name: string;
    type: TimerSpeakerType;
  }) => void;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onEditingNameChange: (name: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onTakeFromAgenda?: () => void;
  shareSlot: React.ReactNode;
}

function SpeakerView({
  speakers,
  activeId,
  now,
  members,
  guests,
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
  onTakeFromAgenda,
  shareSlot,
}: SpeakerViewProps) {
  const active = speakers.find((speaker) => speaker.id === activeId) ?? null;
  const elapsed = active ? computeElapsed(active, now) : 0;

  return (
    <div className="flex flex-col gap-4">
      {shareSlot ? <div className="flex justify-end">{shareSlot}</div> : null}

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
        <AddSpeakerForm members={members} guests={guests} onCommit={onAdd} onCancel={onCancelAdd} />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            block
            size="large"
            type="dashed"
            icon={<Play size={14} weight="fill" className="rotate-90" />}
            onClick={onStartAdd}
          >
            + Add Speaker
          </Button>
          {onTakeFromAgenda ? (
            <Button
              block
              size="large"
              icon={<ClipboardText size={16} weight="bold" />}
              onClick={onTakeFromAgenda}
            >
              Take from agenda
            </Button>
          ) : null}
        </div>
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
              const brackets = speaker.brackets ?? TYPE_BRACKETS[speaker.type];
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

interface TimerViewProps {
  meetingId: string;
  showShare: boolean;
  /** Share-link credential — only meaningful (and only provided) on the
   * public page, where it stands in for the auth "Take from agenda" would
   * otherwise need. */
  token?: string;
}

/** Shared Timer view — used by both the in-app tab and the public share page.
 * State is persisted per meeting so both surfaces stay in sync. */
export function TimerView({ meetingId, showShare, token = '' }: TimerViewProps) {
  const { data: members } = useGetMembersQuery(undefined, { skip: !showShare });
  const { data: guests } = useGetGuestsQuery(undefined, { skip: !showShare });
  const { data: roleRows } = useGetMeetingRolesQuery(meetingId, { skip: !showShare });
  const { data: preparedSpeakers } = useGetPreparedSpeakersQuery(meetingId, { skip: !showShare });
  // Public counterpart of the four queries above — an anonymous caller can't
  // reach `/members`, `/guests`, or the authenticated roles/prepared-speakers
  // endpoints (full roster, PII), so the server pre-computes the same
  // sources those four feed into `buildAgendaSpeakerSources` below.
  const { data: publicAgendaSpeakers } = useGetPublicAgendaSpeakerSourcesQuery(
    { meetingId, token },
    { skip: showShare || !meetingId || !token },
  );
  const { activeKey, onChange } = usePersistentTab('timer-view', 'speaker');

  const subscribe = useCallback(
    (notify: () => void) => subscribeToRoleState('timer', meetingId, notify),
    [meetingId],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => readRoleStateRaw('timer', meetingId),
    () => null,
  );
  const state = parseRoleState('timer', raw);
  const { speakers, activeId } = state;

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [now, setNow] = useState(0);

  const activeSpeaker = speakers.find((speaker) => speaker.id === activeId) ?? null;
  const isRunning = activeSpeaker?.status === 'running';

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isRunning, activeId]);

  function handleAdd(draft: {
    memberId?: string;
    guestId?: string;
    name: string;
    type: TimerSpeakerType;
  }) {
    const id = crypto.randomUUID();
    updateRoleState('timer', meetingId, (previous) => ({
      activeId: id,
      speakers: [
        ...previous.speakers,
        {
          id,
          memberId: draft.memberId,
          guestId: draft.guestId,
          name: draft.name,
          type: draft.type,
          status: 'idle',
          elapsed: 0,
        },
      ],
    }));
    setAdding(false);
  }

  function handleTakeFromAgenda() {
    const sources = showShare
      ? buildAgendaSpeakerSources(
          preparedSpeakers ?? [],
          roleRows ?? [],
          members ?? [],
          guests ?? [],
        )
      : fromPublicAgendaSpeakerSources(publicAgendaSpeakers ?? []);
    updateRoleState('timer', meetingId, (previous) => {
      const manual = previous.speakers.filter((speaker) => !speaker.agendaKey);
      const byAgendaKey = new Map(
        previous.speakers.filter((speaker) => speaker.agendaKey).map((s) => [s.agendaKey!, s]),
      );

      const nextAgendaSpeakers = sources.map((source) => {
        const type: TimerSpeakerType =
          source.role === 'speaker'
            ? 'Prepared Speaker'
            : source.role === 'evaluator'
              ? 'Speech Evaluator'
              : source.role === 'general-evaluator'
                ? 'General Evaluator'
                : 'TT Evaluator';
        const brackets = source.durationBounds
          ? bracketFromDuration(source.durationBounds)
          : undefined;

        const existing = byAgendaKey.get(source.agendaKey);
        if (existing) {
          return {
            ...existing,
            memberId: source.memberId,
            guestId: source.guestId,
            name: source.name,
            type,
            brackets,
          };
        }
        const adoptedIndex = manual.findIndex(
          (speaker) =>
            (source.memberId && speaker.memberId === source.memberId) ||
            (source.guestId && speaker.guestId === source.guestId),
        );
        if (adoptedIndex !== -1) {
          const [adopted] = manual.splice(adoptedIndex, 1);
          return {
            ...adopted,
            memberId: source.memberId,
            guestId: source.guestId,
            name: source.name,
            type,
            brackets,
            agendaKey: source.agendaKey,
          };
        }
        return {
          id: crypto.randomUUID(),
          memberId: source.memberId,
          guestId: source.guestId,
          name: source.name,
          type,
          status: 'idle' as const,
          elapsed: 0,
          brackets,
          agendaKey: source.agendaKey,
        };
      });

      const nextSpeakers = [...nextAgendaSpeakers, ...manual];
      const activeStillPresent = nextSpeakers.some((speaker) => speaker.id === previous.activeId);
      return {
        speakers: nextSpeakers,
        activeId: activeStillPresent ? previous.activeId : null,
      };
    });
  }

  function handleDelete(id: string) {
    updateRoleState('timer', meetingId, (previous) => ({
      speakers: previous.speakers.filter((speaker) => speaker.id !== id),
      activeId: previous.activeId === id ? null : previous.activeId,
    }));
    if (editingId === id) {
      setEditingId(null);
      setEditingName('');
    }
  }

  function handleSelect(id: string) {
    updateRoleState('timer', meetingId, (previous) => ({ ...previous, activeId: id }));
  }

  function handleStart() {
    if (!activeId) return;
    const startedAt = Date.now();
    updateRoleState('timer', meetingId, (previous) => ({
      ...previous,
      speakers: previous.speakers.map<TimerSpeaker>((speaker) => {
        if (speaker.id === previous.activeId) {
          return { ...speaker, status: 'running', startedAt };
        }
        /* Any other running timer commits to `done` — one speaker on the clock
         * at a time. */
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
    }));
  }

  function handleStop() {
    if (!activeId) return;
    const stoppedAt = Date.now();
    updateRoleState('timer', meetingId, (previous) => ({
      ...previous,
      speakers: previous.speakers.map<TimerSpeaker>((speaker) => {
        if (speaker.id !== previous.activeId) return speaker;
        if (speaker.status !== 'running' || speaker.startedAt === undefined) return speaker;
        const nextElapsed = speaker.elapsed + (stoppedAt - speaker.startedAt) / 1000;
        return { ...speaker, status: 'done', elapsed: nextElapsed, startedAt: undefined };
      }),
    }));
  }

  function handleReset() {
    if (!activeId) return;
    updateRoleState('timer', meetingId, (previous) => ({
      ...previous,
      speakers: previous.speakers.map<TimerSpeaker>((speaker) =>
        speaker.id === previous.activeId
          ? { ...speaker, status: 'idle', elapsed: 0, startedAt: undefined }
          : speaker,
      ),
    }));
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
    updateRoleState('timer', meetingId, (previous) => ({
      ...previous,
      speakers: previous.speakers.map((speaker) =>
        speaker.id === editingId ? { ...speaker, name: trimmed } : speaker,
      ),
    }));
    setEditingId(null);
    setEditingName('');
  }

  function handleCancelRename() {
    setEditingId(null);
    setEditingName('');
  }

  const shareSlot = showShare ? (
    <ShareRoleButton
      meetingId={meetingId}
      kind="timer"
      roleLabel="Timer"
      ariaLabel="Share Timer role"
    />
  ) : null;

  return (
    <section className="mx-auto max-w-4xl">
      <Tabs
        activeKey={activeKey}
        onChange={onChange}
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
                members={members ?? []}
                guests={guests ?? []}
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
                onTakeFromAgenda={handleTakeFromAgenda}
                shareSlot={shareSlot}
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

interface TimerTabProps {
  meetingId: string;
}

/** Timer tab — shows the share button so the meeting host can hand the QR link
 * to the timer role. Public role page renders the same view without it. */
export function TimerTab({ meetingId }: TimerTabProps) {
  return <TimerView meetingId={meetingId} showShare />;
}
