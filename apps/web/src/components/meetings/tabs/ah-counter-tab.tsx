'use client';

import { CaretDown, Minus, Plus, Tag, TrashSimple, X } from '@phosphor-icons/react/dist/ssr';
import { AutoComplete, Button, Input, Popover, Tabs } from 'antd';
import { useMemo, useState } from 'react';

import { useGetMembersQuery } from '@/store/api';

/** Filler-word categories the club tracks by default. Users can add and
 * remove entries after mount — this is just the starting set. */
const DEFAULT_CATEGORIES = ['AH', 'UM', 'ERR', 'THE'];

interface SpeakerCount {
  id: string;
  /** Linked member — undefined for guest speakers typed by hand. */
  memberId?: string;
  /** Display name captured at add time (member's full name or the guest
   * name the user typed). Cached so a member rename doesn't drift the log. */
  name: string;
  /** Per-category counts. Missing keys read as 0. Data is preserved even
   * after a category is removed, so re-adding restores the prior tally. */
  counts: Record<string, number>;
  expanded: boolean;
}

function totalOf(speaker: SpeakerCount, categories: readonly string[]): number {
  let sum = 0;
  for (const category of categories) sum += speaker.counts[category] ?? 0;
  return sum;
}

/** Card labels are all-caps; table labels are title-case. The user types
 * whatever casing they want and we normalize at render time. */
function cardLabel(category: string): string {
  return category.toUpperCase();
}

function tableLabel(category: string): string {
  if (category.length === 0) return category;
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

interface MemberOption {
  value: string;
  label: string;
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
  speaker: SpeakerCount;
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
          {/* Design intent from the reference: chevron points up when expanded
           * (i.e. tap it to fold the card away). Rotate the default `Down`
           * icon rather than swap components so the transition stays smooth. */}
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
  availableOptions: MemberOption[];
  onCommit: (draft: { memberId?: string; name: string }) => void;
  onCancel: () => void;
}

function SpeakerPicker({ availableOptions, onCommit, onCancel }: SpeakerPickerProps) {
  const [draft, setDraft] = useState('');

  /* Look for an exact (case-insensitive) match against the roster — if it
   * hits, we link to that member; otherwise the string becomes a guest name. */
  function commit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const matched = availableOptions.find(
      (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (matched) onCommit({ memberId: matched.value, name: matched.label });
    else onCommit({ name: trimmed });
    setDraft('');
  }

  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-sidebar p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <AutoComplete
          className="w-full"
          size="large"
          value={draft}
          onChange={(value) => setDraft(value)}
          onSelect={(value: string) => commit(value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(draft);
            }
          }}
          options={availableOptions.map((option) => ({ value: option.label }))}
          filterOption={(input, option) =>
            String(option?.value ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
          /* Turning off the first-option highlight means Enter on a
           * no-match query commits the typed text as a guest name instead
           * of jumping to whatever suggestion was on top. */
          defaultActiveFirstOption={false}
          placeholder="Search a member or type a guest name"
          autoFocus
        />
        <div className="flex items-center gap-2 sm:shrink-0">
          <Button type="primary" onClick={() => commit(draft)} disabled={!draft.trim()}>
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
  speakers: SpeakerCount[];
  categories: string[];
  availableOptions: MemberOption[];
  adding: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAdd: (draft: { memberId?: string; name: string }) => void;
  onDelete: (id: string) => void;
  onAdjust: (id: string, category: string, delta: number) => void;
  onToggle: (id: string) => void;
  onAddCategory: (label: string) => boolean;
  onRemoveCategory: (label: string) => void;
}

function SpeakersView({
  speakers,
  categories,
  availableOptions,
  adding,
  onStartAdd,
  onCancelAdd,
  onAdd,
  onDelete,
  onAdjust,
  onToggle,
  onAddCategory,
  onRemoveCategory,
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
          <Button
            size="middle"
            type="primary"
            icon={<Plus size={14} weight="bold" />}
            onClick={onStartAdd}
            disabled={adding}
          >
            Add Speaker
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {adding ? (
          <SpeakerPicker
            availableOptions={availableOptions}
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
  speakers: SpeakerCount[];
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
      {/* Horizontal scroll on narrow screens keeps the columns readable
       * without shrinking each cell into unreadable ellipses. */}
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

/** Ah Counter tab — two sub-tabs sharing the same state. Speakers holds the
 * per-speaker counter cards with +/− controls, Result shows the same data as
 * a compact tabular summary. Both categories and speakers persist to local
 * state for now. Categories are user-configurable (add / remove) and apply to
 * every speaker; speakers can be either roster members or free-typed guests. */
export function AhCounterTab() {
  const { data: members } = useGetMembersQuery();
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [speakers, setSpeakers] = useState<SpeakerCount[]>([]);
  const [adding, setAdding] = useState(false);

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

  /* Filter out members already listed so the same person can't be added
   * twice by mistake. Guests (no memberId) don't affect the filter — you
   * can add "Guest speaker" as many times as needed. */
  const availableOptions = useMemo(() => {
    const usedIds = new Set(
      speakers.map((speaker) => speaker.memberId).filter((id): id is string => Boolean(id)),
    );
    return memberOptions.filter((option) => !usedIds.has(option.value));
  }, [memberOptions, speakers]);

  function handleAdd(draft: { memberId?: string; name: string }) {
    setSpeakers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        memberId: draft.memberId,
        name: draft.name,
        counts: {},
        expanded: true,
      },
    ]);
    setAdding(false);
  }

  function handleDelete(id: string) {
    setSpeakers((prev) => prev.filter((speaker) => speaker.id !== id));
  }

  function handleAdjust(id: string, category: string, delta: number) {
    setSpeakers((prev) =>
      prev.map((speaker) => {
        if (speaker.id !== id) return speaker;
        const current = speaker.counts[category] ?? 0;
        const next = Math.max(0, current + delta);
        return { ...speaker, counts: { ...speaker.counts, [category]: next } };
      }),
    );
  }

  function handleToggle(id: string) {
    setSpeakers((prev) =>
      prev.map((speaker) =>
        speaker.id === id ? { ...speaker, expanded: !speaker.expanded } : speaker,
      ),
    );
  }

  /** Returns true if the category was added; false if it collides with an
   * existing one (case-insensitive). Popover uses the return to show an
   * inline error instead of silently dropping the input. */
  function handleAddCategory(label: string): boolean {
    const trimmed = label.trim();
    if (!trimmed) return false;
    const exists = categories.some((existing) => existing.toLowerCase() === trimmed.toLowerCase());
    if (exists) return false;
    setCategories((prev) => [...prev, trimmed]);
    return true;
  }

  function handleRemoveCategory(label: string) {
    setCategories((prev) => prev.filter((category) => category !== label));
  }

  return (
    <section className="mx-auto max-w-4xl">
      <Tabs
        defaultActiveKey="speakers"
        size="middle"
        items={[
          {
            key: 'speakers',
            label: 'Speakers',
            children: (
              <SpeakersView
                speakers={speakers}
                categories={categories}
                availableOptions={availableOptions}
                adding={adding}
                onStartAdd={() => setAdding(true)}
                onCancelAdd={() => setAdding(false)}
                onAdd={handleAdd}
                onDelete={handleDelete}
                onAdjust={handleAdjust}
                onToggle={handleToggle}
                onAddCategory={handleAddCategory}
                onRemoveCategory={handleRemoveCategory}
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
