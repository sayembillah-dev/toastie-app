'use client';

import { ClipboardText, Plus } from '@phosphor-icons/react/dist/ssr';
import { Button } from 'antd';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import { SpeakersViewMobile } from '@/components/meetings/tabs/ah-counter-mobile';
import {
  assigneeToDraft,
  FillerWordsPopover,
  SpeakerCard,
} from '@/components/meetings/tabs/ah-counter-shared';
import { ShareRoleButton } from '@/components/meetings/tabs/share-role-button';
import type { Member } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';
import {
  buildAgendaSpeakerSources,
  fromPublicAgendaSpeakerSources,
} from '@/lib/meetings/agenda-speaker-sources';
import {
  type AhSpeakerCount,
  parseRoleState,
  readRoleStateRaw,
  subscribeToRoleState,
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

interface SpeakerPickerProps {
  members: Member[];
  guests: Guest[];
  onCommit: (draft: { memberId?: string; guestId?: string; name: string }) => void;
  onCancel: () => void;
}

/** Desktop inline add-speaker form — mobile replaces this with a bottom
 * sheet opened from the FAB (see `ah-counter-mobile.tsx`). */
function SpeakerPicker({ members, guests, onCommit, onCancel }: SpeakerPickerProps) {
  const [pending, setPending] = useState<Assignee | null>(null);

  function commit() {
    if (!pending) return;
    onCommit(assigneeToDraft(pending, members));
    setPending(null);
  }

  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-sidebar p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full rounded-lg border border-line bg-canvas px-2">
          <AssigneeSelect
            value={pending}
            onChange={setPending}
            members={members}
            guests={guests}
            placeholder="Search a member or type a guest name"
            ariaLabel="Speaker"
          />
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <Button type="primary" onClick={commit} disabled={!pending}>
            Add
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink-muted">
        Not in the roster? Just type the name and press Add.
      </p>
    </div>
  );
}

interface SpeakersViewProps {
  speakers: AhSpeakerCount[];
  categories: string[];
  availableMembers: Member[];
  availableGuests: Guest[];
  adding: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAdd: (draft: { memberId?: string; guestId?: string; name: string }) => void;
  onDelete: (id: string) => void;
  onAdjust: (id: string, category: string, delta: number) => void;
  onToggle: (id: string) => void;
  onAddCategory: (label: string) => boolean;
  onRemoveCategory: (label: string) => void;
  onTakeFromAgenda?: () => void;
  shareSlot: React.ReactNode;
}

/** Desktop Speakers pane — phones render `SpeakersViewMobile` instead. */
function SpeakersView({
  speakers,
  categories,
  availableMembers,
  availableGuests,
  adding,
  onStartAdd,
  onCancelAdd,
  onAdd,
  onDelete,
  onAdjust,
  onToggle,
  onAddCategory,
  onRemoveCategory,
  onTakeFromAgenda,
  shareSlot,
}: SpeakersViewProps) {
  return (
    <div className="rounded-2xl border border-line bg-canvas p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
          Counts
        </span>
        <div className="flex items-center gap-2">
          <FillerWordsPopover
            categories={categories}
            onAdd={onAddCategory}
            onRemove={onRemoveCategory}
          />
          {onTakeFromAgenda ? (
            <Button
              size="middle"
              icon={<ClipboardText size={14} weight="bold" />}
              onClick={onTakeFromAgenda}
            >
              Take from agenda
            </Button>
          ) : null}
          <Button
            size="middle"
            type="primary"
            icon={<Plus size={14} weight="bold" />}
            onClick={onStartAdd}
            disabled={adding}
          >
            Add Speaker
          </Button>
          {shareSlot}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {adding ? (
          <SpeakerPicker
            members={availableMembers}
            guests={availableGuests}
            onCommit={onAdd}
            onCancel={onCancelAdd}
          />
        ) : null}

        {speakers.length === 0 && !adding ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">No speakers yet</p>
            <p className="mt-1 text-xs text-ink-muted">
              Use &ldquo;Add Speaker&rdquo; to start counting for members as they speak.
            </p>
          </div>
        ) : (
          speakers.map((speaker) => (
            <SpeakerCard
              key={speaker.id}
              speaker={speaker}
              categories={categories}
              onDelete={() => onDelete(speaker.id)}
              onAdjust={(category, delta) => onAdjust(speaker.id, category, delta)}
              onToggle={() => onToggle(speaker.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface AhCounterViewProps {
  meetingId: string;
  showShare: boolean;
  /** Share-link credential — only meaningful (and only provided) on the
   * public page, where it stands in for the auth "Take from agenda" would
   * otherwise need. */
  token?: string;
}

/** Shared Ah Counter view — used by the in-app tab and the public share page.
 * State is persisted per meeting so both surfaces stay in sync. The view owns
 * every query/mutation/handler; only the Speakers pane's presentation forks
 * by breakpoint (desktop action-row + inline form vs mobile FAB + sheets). */
export function AhCounterView({ meetingId, showShare, token = '' }: AhCounterViewProps) {
  useRoleStateSync('ah-counter', meetingId, showShare ? undefined : token);
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
    (notify: () => void) => subscribeToRoleState('ah-counter', meetingId, notify),
    [meetingId],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => readRoleStateRaw('ah-counter', meetingId),
    () => null,
  );
  const state = parseRoleState('ah-counter', raw);
  const { categories, speakers } = state;

  const [adding, setAdding] = useState(false);

  const availableMembers = useMemo(() => {
    const usedIds = new Set(
      speakers.map((speaker) => speaker.memberId).filter((id): id is string => Boolean(id)),
    );
    return (members ?? []).filter((member) => !usedIds.has(member.id));
  }, [members, speakers]);

  const availableGuests = useMemo(() => {
    const usedIds = new Set(
      speakers.map((speaker) => speaker.guestId).filter((id): id is string => Boolean(id)),
    );
    return (guests ?? []).filter((guest) => !usedIds.has(guest.id));
  }, [guests, speakers]);

  function handleAdd(draft: { memberId?: string; guestId?: string; name: string }) {
    const speaker: AhSpeakerCount = {
      id: crypto.randomUUID(),
      memberId: draft.memberId,
      guestId: draft.guestId,
      name: draft.name,
      counts: {},
      expanded: true,
    };
    updateRoleState('ah-counter', meetingId, (previous) => ({
      ...previous,
      speakers: [...previous.speakers, speaker],
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
    updateRoleState('ah-counter', meetingId, (previous) => {
      const manual = previous.speakers.filter((speaker) => !speaker.agendaKey);
      const byAgendaKey = new Map(
        previous.speakers.filter((speaker) => speaker.agendaKey).map((s) => [s.agendaKey!, s]),
      );

      const nextAgendaSpeakers = sources.map((source) => {
        const existing = byAgendaKey.get(source.agendaKey);
        if (existing) {
          return {
            ...existing,
            memberId: source.memberId,
            guestId: source.guestId,
            name: source.name,
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
            agendaKey: source.agendaKey,
          };
        }
        return {
          id: crypto.randomUUID(),
          memberId: source.memberId,
          guestId: source.guestId,
          name: source.name,
          counts: {},
          expanded: false,
          agendaKey: source.agendaKey,
        };
      });

      return { ...previous, speakers: [...nextAgendaSpeakers, ...manual] };
    });
  }

  function handleDelete(id: string) {
    updateRoleState('ah-counter', meetingId, (previous) => ({
      ...previous,
      speakers: previous.speakers.filter((speaker) => speaker.id !== id),
    }));
  }

  function handleAdjust(id: string, category: string, delta: number) {
    updateRoleState('ah-counter', meetingId, (previous) => ({
      ...previous,
      speakers: previous.speakers.map((speaker) => {
        if (speaker.id !== id) return speaker;
        const current = speaker.counts[category] ?? 0;
        const next = Math.max(0, current + delta);
        return { ...speaker, counts: { ...speaker.counts, [category]: next } };
      }),
    }));
  }

  function handleToggle(id: string) {
    updateRoleState('ah-counter', meetingId, (previous) => ({
      ...previous,
      speakers: previous.speakers.map((speaker) =>
        speaker.id === id ? { ...speaker, expanded: !speaker.expanded } : speaker,
      ),
    }));
  }

  function handleAddCategory(label: string): boolean {
    const trimmed = label.trim();
    if (!trimmed) return false;
    const exists = categories.some((existing) => existing.toLowerCase() === trimmed.toLowerCase());
    if (exists) return false;
    updateRoleState('ah-counter', meetingId, (previous) => ({
      ...previous,
      categories: [...previous.categories, trimmed],
    }));
    return true;
  }

  function handleRemoveCategory(label: string) {
    updateRoleState('ah-counter', meetingId, (previous) => ({
      ...previous,
      categories: previous.categories.filter((category) => category !== label),
    }));
  }

  const shareSlot = showShare ? (
    <ShareRoleButton
      meetingId={meetingId}
      kind="ah-counter"
      roleLabel="Ah Counter"
      ariaLabel="Share Ah Counter role"
    />
  ) : null;

  const speakersPane =
    isMobile === true ? (
      /* Mobile: share lives in the drawer header (`headerExtra`), adding and
       * take-from-agenda in the FAB speed-dial, and counting in a bottom
       * sheet off each row — the accordion's `expanded` toggling is
       * desktop-only. */
      <SpeakersViewMobile
        speakers={speakers}
        categories={categories}
        availableMembers={availableMembers}
        availableGuests={availableGuests}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onAdjust={handleAdjust}
        onAddCategory={handleAddCategory}
        onRemoveCategory={handleRemoveCategory}
        onTakeFromAgenda={handleTakeFromAgenda}
      />
    ) : (
      <SpeakersView
        speakers={speakers}
        categories={categories}
        availableMembers={availableMembers}
        availableGuests={availableGuests}
        adding={adding}
        onStartAdd={() => setAdding(true)}
        onCancelAdd={() => setAdding(false)}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onAdjust={handleAdjust}
        onToggle={handleToggle}
        onAddCategory={handleAddCategory}
        onRemoveCategory={handleRemoveCategory}
        onTakeFromAgenda={handleTakeFromAgenda}
        shareSlot={shareSlot}
      />
    );

  /* No Result tab — the speaker rows carry live totals and the counting
   * surface (desktop accordion body, mobile sheet) shows every category, so
   * a separate report duplicated what the pane already tells you. */
  return (
    <section className="mx-auto max-w-4xl">
      {/* Breakpoint not resolved yet (server / first client frame) — show a
       * placeholder rather than guessing a layout. */}
      {isMobile === null ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-14 animate-pulse rounded-xl bg-fill" />
          <div className="h-14 animate-pulse rounded-xl bg-fill" />
          <div className="h-14 animate-pulse rounded-xl bg-fill" />
        </div>
      ) : (
        speakersPane
      )}
    </section>
  );
}

interface AhCounterTabProps {
  meetingId: string;
}

/** Ah Counter tab — shows the share button so meeting hosts can hand out the
 * public link. The public role page renders the same view without the button. */
export function AhCounterTab({ meetingId }: AhCounterTabProps) {
  return <AhCounterView meetingId={meetingId} showShare />;
}
