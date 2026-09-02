'use client';

import { CaretDown, Minus, Plus, TextAa, TrashSimple, X } from '@phosphor-icons/react/dist/ssr';
import { Button, Input, Popover } from 'antd';
import { useState } from 'react';

import type { Member } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';
import type { AhSpeakerCount } from '@/lib/meetings/role-state';

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

export function totalOf(speaker: AhSpeakerCount, categories: readonly string[]): number {
  let sum = 0;
  for (const category of categories) sum += speaker.counts[category] ?? 0;
  return sum;
}

export function cardLabel(category: string): string {
  return category.toUpperCase();
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
      {/* Tap targets grow a step on phones (36px, `size-9`) — counting is the
       * live-meeting interaction, tapped rapidly while listening. */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value === 0}
          aria-label={`Decrement ${label}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-muted transition-colors hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas md:size-8"
        >
          <Minus size={14} weight="bold" />
        </button>
        <button
          type="button"
          onClick={onIncrement}
          aria-label={`Increment ${label}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas md:size-8"
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

/** One speaker's counting card — collapsed to a name + total row, expanding
 * to a per-category +/- grid. Shared verbatim by the desktop pane and the
 * mobile list. */
export function SpeakerCard({
  speaker,
  categories,
  onDelete,
  onAdjust,
  onToggle,
}: SpeakerCardProps) {
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
            No words to count yet — add one from{' '}
            <span className="font-medium text-ink">Filler Words</span> to start counting.
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

interface FillerWordsPopoverProps {
  categories: string[];
  onAdd: (label: string) => boolean;
  onRemove: (label: string) => void;
}

/** Filler-word manager — the one header control both panes keep (adding
 * speakers and taking from the agenda move to the FAB on mobile, and share
 * moves to the drawer header). */
export function FillerWordsPopover({ categories, onAdd, onRemove }: FillerWordsPopoverProps) {
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
        One column per word. Removing a word hides its column but keeps the counts already tallied.
      </p>
      {categories.length === 0 ? (
        <p className="mb-3 rounded-lg bg-fill px-2.5 py-2 text-[11px] text-ink-muted">
          No words yet.
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
      <Button size="middle" icon={<TextAa size={14} weight="bold" />}>
        Filler Words
      </Button>
    </Popover>
  );
}
