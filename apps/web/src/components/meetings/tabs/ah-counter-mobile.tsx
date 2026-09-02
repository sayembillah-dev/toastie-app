'use client';

import {
  ClipboardText,
  Minus,
  Plus,
  TrashSimple,
  UserPlus,
  X,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Drawer } from 'antd';
import { useState } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import {
  assigneeToDraft,
  cardLabel,
  FillerWordsPopover,
  totalOf,
} from '@/components/meetings/tabs/ah-counter-shared';
import type { Member } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';
import type { AhSpeakerCount } from '@/lib/meetings/role-state';
import type { Guest } from '@/lib/people/guests';

type SpeakerDraft = {
  memberId?: string;
  guestId?: string;
  name: string;
};

interface AddSpeakerSheetProps {
  open: boolean;
  members: Member[];
  guests: Guest[];
  onCommit: (draft: SpeakerDraft) => void;
  onClose: () => void;
}

/** Mobile "add a speaker to count" form, presented as a bottom sheet off the
 * FAB. Local draft state resets on every close path (backdrop, Cancel, Add)
 * so the sheet always reopens fresh. */
function AddSpeakerSheet({ open, members, guests, onCommit, onClose }: AddSpeakerSheetProps) {
  const [pending, setPending] = useState<Assignee | null>(null);

  function handleCancel() {
    setPending(null);
    onClose();
  }

  function handleCommit() {
    if (!pending) return;
    onCommit(assigneeToDraft(pending, members));
    setPending(null);
    onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={handleCancel}
      placement="bottom"
      size="auto"
      /* The Ah Counter lives inside the mobile feature drawer; opening this
       * sheet makes rc-drawer tell the parent to push. The parent's own
       * `push={false}` is what actually stops that — this zero-distance
       * config only guards against any future sheet nested inside this one. */
      push={false}
      destroyOnHidden
      title="Add speaker"
      styles={{
        section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        body: { padding: 16, overflowY: 'auto', maxHeight: '70dvh' },
        footer: {
          paddingInline: 16,
          paddingTop: 12,
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        },
      }}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button size="large" block onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="primary" size="large" block onClick={handleCommit} disabled={!pending}>
            Add Speaker
          </Button>
        </div>
      }
    >
      <div>
        <p id="ah-speaker-name-label" className="mb-1.5 text-xs font-medium text-ink">
          Speaker name
        </p>
        <AssigneeSelect
          value={pending}
          onChange={setPending}
          members={members}
          guests={guests}
          placeholder="Search or type a name…"
          ariaLabel="Speaker name"
          variant="outlined"
          size="large"
        />
      </div>
    </Drawer>
  );
}

interface SpeakerRowProps {
  speaker: AhSpeakerCount;
  categories: string[];
  onOpen: () => void;
  onDelete: () => void;
}

/** Compact list row — the whole row is the tap target that opens the
 * counting sheet. Delete stays one tap away on the row (immediate, matching
 * the desktop card header). */
function SpeakerRow({ speaker, categories, onOpen, onDelete }: SpeakerRowProps) {
  const total = totalOf(speaker, categories);

  return (
    <article className="flex items-center gap-1 rounded-xl border border-line bg-canvas py-1.5 pl-4 pr-1.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open counting for ${speaker.name}`}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
      >
        <span className="min-w-0 truncate text-sm font-semibold text-ink">{speaker.name}</span>
        <span className="shrink-0 text-xs font-medium text-ink-muted">
          <span className="font-mono text-sm font-semibold tabular-nums text-ink">{total}</span>
          {' total'}
        </span>
      </button>
      <Button
        type="text"
        size="small"
        aria-label={`Remove ${speaker.name}`}
        icon={<TrashSimple size={16} className="text-ink-muted" />}
        onClick={onDelete}
      />
    </article>
  );
}

interface CountPadProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

/** Big touch-first counter for the sheet — the sheet gives each category
 * room, so pads get 44px +/- targets (the accordion cells' smaller grid is
 * sized for desktop pointer density). */
function CountPad({ label, value, onIncrement, onDecrement }: CountPadProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-4">
      <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
        {label}
      </span>
      <span className="font-mono text-4xl font-semibold leading-none tabular-nums text-ink">
        {value}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value === 0}
          aria-label={`Decrement ${label}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-muted transition-colors hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        >
          <Minus size={16} weight="bold" />
        </button>
        <button
          type="button"
          onClick={onIncrement}
          aria-label={`Increment ${label}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        >
          <Plus size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}

interface CountingSheetProps {
  speaker: AhSpeakerCount | null;
  categories: string[];
  onAdjust: (category: string, delta: number) => void;
  onClose: () => void;
}

/** The counting surface — opens when a speaker row is tapped. Deliberate
 * close only (X button): counts are being tapped rapidly while listening, so
 * a backdrop tap or ESC must not dismiss the sheet mid-speech. Counts
 * themselves persist per tap, so nothing is lost either way. */
function CountingSheet({ speaker, categories, onAdjust, onClose }: CountingSheetProps) {
  return (
    <Drawer
      open={speaker !== null}
      onClose={onClose}
      placement="bottom"
      size="auto"
      push={false}
      destroyOnHidden
      closable={false}
      maskClosable={false}
      keyboard={false}
      styles={{
        section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        body: {
          padding: 16,
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          overflowY: 'auto',
          maxHeight: '85dvh',
        },
      }}
    >
      {speaker ? (
        <div className="relative">
          <button
            type="button"
            aria-label="Close counting"
            onClick={onClose}
            className="absolute right-0 top-0 z-10 flex size-9 items-center justify-center rounded-full bg-fill text-ink-soft transition-colors hover:bg-fill-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            <X size={18} weight="bold" />
          </button>
          <header className="mb-5 pr-12">
            <h3 className="truncate text-base font-semibold text-ink">{speaker.name}</h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              {totalOf(speaker, categories)} counted in total
            </p>
          </header>
          {categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-xs text-ink-muted">
              No words to count yet — add one from{' '}
              <span className="font-medium text-ink">Filler Words</span> to start counting.
            </div>
          ) : (
            <div
              className={`grid gap-3 ${categories.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
            >
              {categories.map((category) => (
                <CountPad
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
      ) : null}
    </Drawer>
  );
}

export interface SpeakersViewMobileProps {
  speakers: AhSpeakerCount[];
  categories: string[];
  availableMembers: Member[];
  availableGuests: Guest[];
  onAdd: (draft: SpeakerDraft) => void;
  onDelete: (id: string) => void;
  onAdjust: (id: string, category: string, delta: number) => void;
  onAddCategory: (label: string) => boolean;
  onRemoveCategory: (label: string) => void;
  onTakeFromAgenda?: () => void;
}

/** Mobile face of the Ah Counter's Speakers pane — speakers render as
 * tappable rows (name + running total) that open a bottom sheet for the
 * actual counting, replacing the desktop accordion. Adding a speaker and
 * taking from the agenda live in a FAB speed-dial; share lives in the
 * drawer header (`headerExtra`); Filler Words keeps a slim top row. All state
 * and mutations stay in `AhCounterView`; this is presentation only. */
export function SpeakersViewMobile({
  speakers,
  categories,
  availableMembers,
  availableGuests,
  onAdd,
  onDelete,
  onAdjust,
  onAddCategory,
  onRemoveCategory,
  onTakeFromAgenda,
}: SpeakersViewMobileProps) {
  const [addOpen, setAddOpen] = useState(false);
  /* Speed-dial: the + FAB fans out into "Add Speaker" / "Take from agenda". */
  const [fabOpen, setFabOpen] = useState(false);
  /* Which speaker the counting sheet shows. Local-only — unlike the timer's
   * activeId this isn't role state; the desktop accordion keeps its own
   * `expanded` flags and neither surface needs the other's open panel. */
  const [openId, setOpenId] = useState<string | null>(null);
  const openSpeaker = speakers.find((speaker) => speaker.id === openId) ?? null;
  const countingOpen = openSpeaker !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <FillerWordsPopover
          categories={categories}
          onAdd={onAddCategory}
          onRemove={onRemoveCategory}
        />
      </div>

      {speakers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">No speakers yet</p>
          <p className="mt-1 text-xs text-ink-muted">
            Tap the + button to add the first speaker to count.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {speakers.map((speaker) => (
            <SpeakerRow
              key={speaker.id}
              speaker={speaker}
              categories={categories}
              onOpen={() => setOpenId(speaker.id)}
              onDelete={() => onDelete(speaker.id)}
            />
          ))}
        </div>
      )}

      {/* Clearance so the FAB never sits on top of the last list row. */}
      <div className="h-20 shrink-0" aria-hidden="true" />

      {addOpen || countingOpen ? null : (
        /* Wrapper owns the fixed positioning — Tailwind's `fixed` class on the
         * Button itself loses to antd's unlayered `.ant-btn { position:
         * relative }` (Tailwind v4 utilities are in a cascade layer), which
         * leaves the button in flow at the wrong spot. */
        <>
          {/* Scrim catches outside taps to collapse the speed-dial. */}
          {fabOpen ? (
            <button
              type="button"
              aria-label="Close add menu"
              onClick={() => setFabOpen(false)}
              className="fixed inset-0 z-30 cursor-default bg-black/10"
            />
          ) : null}
          <div
            className="fixed z-40 flex flex-col items-end gap-3"
            style={{
              right: 'calc(20px + env(safe-area-inset-right))',
              bottom: 'calc(24px + env(safe-area-inset-bottom))',
            }}
          >
            {fabOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setFabOpen(false);
                    setAddOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2.5 text-sm font-medium text-ink shadow-lg"
                >
                  <UserPlus size={16} weight="bold" />
                  Add Speaker
                </button>
                {onTakeFromAgenda ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFabOpen(false);
                      onTakeFromAgenda();
                    }}
                    className="flex items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2.5 text-sm font-medium text-ink shadow-lg"
                  >
                    <ClipboardText size={16} weight="bold" />
                    Take from agenda
                  </button>
                ) : null}
              </>
            ) : null}
            <Button
              type="primary"
              shape="circle"
              aria-label={fabOpen ? 'Close add menu' : 'Add speaker'}
              aria-expanded={fabOpen}
              icon={fabOpen ? <X size={24} weight="bold" /> : <Plus size={24} weight="bold" />}
              onClick={() => setFabOpen((v) => !v)}
              style={{
                width: 56,
                height: 56,
                /* Same story — antd's unlayered box-shadow beats `shadow-lg`. */
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.2)',
              }}
            />
          </div>
        </>
      )}

      <CountingSheet
        speaker={openSpeaker}
        categories={categories}
        onAdjust={(category, delta) => {
          if (openId) onAdjust(openId, category, delta);
        }}
        onClose={() => setOpenId(null)}
      />

      <AddSpeakerSheet
        open={addOpen}
        members={availableMembers}
        guests={availableGuests}
        onCommit={onAdd}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}
