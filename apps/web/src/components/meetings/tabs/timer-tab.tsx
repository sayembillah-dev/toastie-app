'use client';

import { ClipboardText, Play, X } from '@phosphor-icons/react/dist/ssr';
import { Button, Select } from 'antd';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import { ShareRoleButton } from '@/components/meetings/tabs/share-role-button';
import {
  assigneeToDraft,
  bracketFromDuration,
  computeElapsed,
  SpeakerListRow,
  TimerCard,
} from '@/components/meetings/tabs/timer-shared';
import { SpeakerViewMobile } from '@/components/meetings/tabs/timer-speakers-mobile';
import type { Member } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';
import {
  buildAgendaSpeakerSources,
  fromPublicAgendaSpeakerSources,
} from '@/lib/meetings/agenda-speaker-sources';
import {
  parseRoleState,
  readRoleStateRaw,
  subscribeToRoleState,
  TIMER_SPEAKER_TYPES,
  type TimerSpeaker,
  type TimerSpeakerType,
  updateRoleState,
} from '@/lib/meetings/role-state';
import { useRoleStateSync } from '@/lib/meetings/role-state-sync';
import type { Guest } from '@/lib/people/guests';
import { useIsMobile } from '@/lib/ui/use-is-mobile';
import {
  useGetGuestsQuery,
  useGetMeetingRolesQuery,
  useGetMembersQuery,
  useGetPreparedSpeakersQuery,
  useGetPublicAgendaSpeakerSourcesQuery,
} from '@/store/api';

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
  useRoleStateSync('timer', meetingId, showShare ? undefined : token);
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
  const isMobile = useIsMobile();

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

  /* Tick while ANY speaker is running, not just the selected one — starting
   * a clock and then selecting another row leaves the first speaker running
   * in the background, and the mobile list rows show live elapsed time. */
  const anyRunning = speakers.some((speaker) => speaker.status === 'running');

  useEffect(() => {
    if (!anyRunning) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [anyRunning, activeId]);

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
      {/* Breakpoint not resolved yet (server / first client frame) — show a
       * placeholder rather than guessing a layout. */}
      {isMobile === null ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-9 animate-pulse rounded-xl bg-fill" />
          <div className="h-72 animate-pulse rounded-2xl bg-fill" />
          <div className="h-14 animate-pulse rounded-xl bg-fill" />
        </div>
      ) : isMobile ? (
        <SpeakerViewMobile
          speakers={speakers}
          activeId={activeId}
          now={now}
          members={members ?? []}
          guests={guests ?? []}
          editingId={editingId}
          editingName={editingName}
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
        />
      ) : (
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
      )}
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
