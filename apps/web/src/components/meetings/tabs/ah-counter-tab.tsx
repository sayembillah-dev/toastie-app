'use client';

import {
  CaretDown,
  ClipboardText,
  Minus,
  Plus,
  Tag,
  TrashSimple,
  X,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Input, Popover, Tabs } from 'antd';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
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
import type { Guest } from '@/lib/people/guests';
import { usePersistentTab } from '@/lib/ui/use-persistent-tab';
import {
  useGetGuestsQuery,
  useGetMeetingRolesQuery,
  useGetMembersQuery,
  useGetPreparedSpeakersQuery,
  useGetPublicAgendaSpeakerSourcesQuery,
} from '@/store/api';

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

function totalOf(speaker: AhSpeakerCount, categories: readonly string[]): number {
  let sum = 0;
  for (const category of categories) sum += speaker.counts[category] ?? 0;
  return sum;
}

function cardLabel(category: string): string {
  return category.toUpperCase();
}

function tableLabel(category: string): string {
  if (category.length === 0) return category;
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

interface CountCellProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

function CountCell({ label, value, onIncrement, onDecrement }: CountCellProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <span className="max-w-full truncate px-2 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
        {label}
      </span>
      <span className="text-3xl font-semibold leading-none text-ink">{value}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value === 0}
          aria-label={`Decrement ${label}`}
          className="flex size-8 items-center justify-center rounded-full border border-line-strong text-ink-muted transition-colors hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <Minus size={14} weight="bold" />
        </button>
        <button
          type="button"
          onClick={onIncrement}
          aria-label={`Increment ${label}`}
          className="flex size-8 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <Plus size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

interface SpeakerCardProps {
  speaker: AhSpeakerCount;
  categories: string[];
  onDelete: () => void;
  onAdjust: (category: string, delta: number) => void;
  onToggle: () => void;
}

function SpeakerCard({ speaker, categories, onDelete, onAdjust, onToggle }: SpeakerCardProps) {
  const total = totalOf(speaker, categories);
  const bodyId = `ah-body-${speaker.id}`;

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={speaker.expanded}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <CaretDown
            size={14}
            weight="bold"
            aria-hidden
            className={`shrink-0 text-ink-muted transition-transform ${
              speaker.expanded ? 'rotate-180' : ''
            }`}
          />
          <span className="min-w-0 truncate text-sm font-semibold text-ink">{speaker.name}</span>
        </button>
        <span className="shrink-0 text-xs font-medium text-ink-muted">{total} total</span>
        <Button
          type="text"
          size="small"
          aria-label={`Remove ${speaker.name}`}
          icon={<TrashSimple size={16} className="text-ink-muted" />}
          onClick={onDelete}
        />
      </div>

      <div id={bodyId} hidden={!speaker.expanded} className="border-t border-line">
        {categories.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-ink-muted">
            No filler categories — add one from{' '}
            <span className="font-medium text-ink">Fillers</span> to start counting.
          </div>
        ) : (
          <div
            className="grid divide-x divide-line"
            style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}
          >
            {categories.map((category) => (
              <CountCell
                key={category}
                label={cardLabel(category)}
                value={speaker.counts[category] ?? 0}
                onIncrement={() => onAdjust(category, 1)}
                onDecrement={() => onAdjust(category, -1)}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

interface FillersPopoverProps {
  categories: string[];
  onAdd: (label: string) => boolean;
  onRemove: (label: string) => void;
}

function FillersPopover({ categories, onAdd, onRemove }: FillersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!onAdd(trimmed)) {
      setError('Already in the list');
      return;
    }
    setDraft('');
    setError(null);
  }

  const content = (
    <div className="w-64">
      <p className="mb-2 text-xs text-ink-soft">
        Applies to every speaker. Removing hides the column but keeps the counts.
      </p>
      {categories.length === 0 ? (
        <p className="mb-3 rounded-lg bg-fill px-2.5 py-2 text-[11px] text-ink-muted">
          No categories yet.
        </p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <span
              key={category}
              className="inline-flex items-center gap-1 rounded-full bg-fill px-2 py-1 text-[11px] font-semibold text-ink-soft"
            >
              {cardLabel(category)}
              <button
                type="button"
                onClick={() => onRemove(category)}
                aria-label={`Remove ${category}`}
                className="flex size-4 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-fill-strong hover:text-ink"
              >
                <X size={10} weight="bold" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          size="small"
          placeholder="e.g. Like"
          value={draft}
          maxLength={12}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button size="small" type="primary" onClick={handleAdd} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {error ? <p className="mt-1.5 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDraft('');
          setError(null);
        }
      }}
      content={content}
      placement="bottomRight"
    >
      <Button size="middle" icon={<Tag size={14} weight="bold" />}>
        Fillers
      </Button>
    </Popover>
  );
}

interface SpeakerPickerProps {
  members: Member[];
  guests: Guest[];
  onCommit: (draft: { memberId?: string; guestId?: string; name: string }) => void;
  onCancel: () => void;
}

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
    <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
          Counts
        </span>
        <div className="flex items-center gap-2">
          <FillersPopover
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

interface ResultViewProps {
  speakers: AhSpeakerCount[];
  categories: string[];
}

function ResultView({ speakers, categories }: ResultViewProps) {
  if (speakers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
        <p className="text-sm font-medium text-ink">No results yet</p>
        <p className="mt-1 text-xs text-ink-muted">
          Add speakers on the Speakers tab and their counts appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-medium text-ink-muted">
              <th className="sticky left-0 z-10 bg-canvas px-4 py-3 text-left">Speaker</th>
              {categories.map((category) => (
                <th key={category} className="px-4 py-3 text-right">
                  {tableLabel(category)}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {speakers.map((speaker) => {
              const total = totalOf(speaker, categories);
              return (
                <tr key={speaker.id} className="border-b border-line last:border-b-0">
                  <td className="sticky left-0 z-10 bg-canvas px-4 py-3 text-ink-soft">
                    {speaker.name}
                  </td>
                  {categories.map((category) => {
                    const value = speaker.counts[category] ?? 0;
                    return (
                      <td key={category} className="px-4 py-3 text-right text-ink-soft">
                        {value > 0 ? value : <span className="text-ink-muted">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right font-semibold text-ink">
                    {total > 0 ? total : <span className="font-normal text-ink-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
 * State is persisted per meeting so both surfaces stay in sync. */
export function AhCounterView({ meetingId, showShare, token = '' }: AhCounterViewProps) {
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
  const { activeKey, onChange } = usePersistentTab('ahc', 'speakers');

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

  return (
    <section className="mx-auto max-w-4xl">
      <Tabs
        activeKey={activeKey}
        onChange={onChange}
        size="middle"
        items={[
          {
            key: 'speakers',
            label: 'Speakers',
            children: (
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
            ),
          },
          {
            key: 'result',
            label: 'Result',
            children: <ResultView speakers={speakers} categories={categories} />,
          },
        ]}
      />
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
