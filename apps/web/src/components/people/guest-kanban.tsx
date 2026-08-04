'use client';

import { DotsSixVertical } from '@phosphor-icons/react/dist/ssr';
import { App, Select } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import type { Guest, GuestStage } from '@/lib/people/guests';
import {
  GUEST_STAGE_IDS,
  GUEST_STAGES,
  getGuestInitials,
  getGuestSwatch,
  groupGuestsByStage,
} from '@/lib/people/guests';
import { useUpdateGuestMutation } from '@/store/api';

/** The id the card writes into the drag payload. A private type keeps stray
 * drags from elsewhere on the page out of the columns. */
const DRAG_MIME = 'application/x-toastly-guest';

const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function formatShortDate(iso: string): string {
  return SHORT_DATE_FMT.format(new Date(iso));
}

function fullName(guest: Guest): string {
  return `${guest.firstName} ${guest.lastName}`;
}

function columnLabel(label: string, count: number): string {
  return `${label} — ${count} ${count === 1 ? 'guest' : 'guests'}`;
}

function visitSummary(guest: Guest): string {
  const visits = guest.visitCount === 1 ? '1 visit' : `${guest.visitCount} visits`;
  return `${visits} · ${formatShortDate(guest.lastVisit)}`;
}

interface GuestAvatarProps {
  guest: Guest;
  size: 'sm' | 'md';
}

function GuestAvatar({ guest, size }: GuestAvatarProps) {
  const swatch = getGuestSwatch(guest.id);
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${
        size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs'
      }`}
      style={{ backgroundColor: swatch.bg, color: swatch.fg }}
    >
      {getGuestInitials(guest)}
    </span>
  );
}

/* ------------------------------------------------------------- desktop --- */

interface KanbanCardProps {
  guest: Guest;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  /** Arrow keys walk the card along the pipeline, so the board is usable
   * without a mouse — dragging is the shortcut, not the only route. */
  onMoveByOffset: (offset: number) => void;
  /** Enter/Space or a plain click opens the guest's profile. Dragging is a
   * separate gesture: a click without movement fires this; a drag never does. */
  onOpen: () => void;
}

function KanbanCard({
  guest,
  isDragging,
  onDragStart,
  onDragEnd,
  onMoveByOffset,
  onOpen,
}: KanbanCardProps) {
  return (
    <button
      type="button"
      draggable
      aria-label={`${fullName(guest)} — press Enter to open, arrow keys to change stage`}
      onClick={onOpen}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_MIME, guest.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        onMoveByOffset(event.key === 'ArrowLeft' ? -1 : 1);
      }}
      /* `guest-drag-source` is the WebKit opt-in that lets a form control start
       * a drag — see globals.css. */
      className={`group guest-drag-source w-full cursor-grab rounded-lg border border-line bg-canvas px-2 py-1.5 text-left transition-all hover:border-line-strong hover:shadow-sm focus:outline-none focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center gap-1.5">
        <GuestAvatar guest={guest} size="sm" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
          {fullName(guest)}
        </span>
        <DotsSixVertical
          size={12}
          aria-hidden
          className="shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
      <p className="mt-1 truncate text-[10px] text-ink-muted">{visitSummary(guest)}</p>
    </button>
  );
}

interface KanbanColumnProps {
  stage: (typeof GUEST_STAGES)[number];
  guests: Guest[];
  draggingId: string | null;
  isDropTarget: boolean;
  onDragOverColumn: () => void;
  onDragLeaveColumn: () => void;
  onDropGuest: (guestId: string) => void;
  onCardDragStart: (guestId: string) => void;
  onCardDragEnd: () => void;
  onMoveByOffset: (guest: Guest, offset: number) => void;
  onOpenGuest: (guest: Guest) => void;
}

function KanbanColumn({
  stage,
  guests,
  draggingId,
  isDropTarget,
  onDragOverColumn,
  onDragLeaveColumn,
  onDropGuest,
  onCardDragStart,
  onCardDragEnd,
  onMoveByOffset,
  onOpenGuest,
}: KanbanColumnProps) {
  return (
    <section
      aria-label={columnLabel(stage.label, guests.length)}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
        // Only a prevented dragover marks the column as a valid drop zone.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragOverColumn();
      }}
      onDragLeave={(event) => {
        // Moving between the column's own children re-fires dragleave; ignore
        // those so the highlight does not strobe under the cursor.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        onDragLeaveColumn();
      }}
      onDrop={(event) => {
        const guestId = event.dataTransfer.getData(DRAG_MIME);
        if (!guestId) return;
        event.preventDefault();
        onDropGuest(guestId);
      }}
      className={`flex min-w-0 flex-col rounded-xl border transition-colors ${
        isDropTarget ? 'border-line-strong bg-fill' : 'border-line bg-sidebar'
      }`}
    >
      <header className="flex shrink-0 items-center gap-1.5 px-2.5 py-2">
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: stage.accent }}
        />
        <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          {stage.label}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-fill-strong px-1.5 text-[10px] font-semibold leading-4 text-ink-soft">
          {guests.length}
        </span>
      </header>

      {/* Fixed height so the board itself never scrolls sideways or past the
       * fold — a long column scrolls inside its own track instead. */}
      <div className="flex h-56 flex-col gap-1.5 overflow-y-auto px-1.5 pb-1.5 lg:h-48 xl:h-[calc(100vh-24rem)] xl:min-h-48">
        {guests.length === 0 ? (
          <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line-strong text-center text-[10px] text-ink-muted">
            {isDropTarget ? 'Drop here' : 'Empty'}
          </p>
        ) : (
          guests.map((guest) => (
            <KanbanCard
              key={guest.id}
              guest={guest}
              isDragging={draggingId === guest.id}
              onDragStart={() => onCardDragStart(guest.id)}
              onDragEnd={onCardDragEnd}
              onMoveByOffset={(offset) => onMoveByOffset(guest, offset)}
              onOpen={() => onOpenGuest(guest)}
            />
          ))
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- mobile --- */

interface MobileBoardProps {
  guests: Guest[];
  onStageChange: (guest: Guest, stage: GuestStage) => void;
}

/** Phones keep the columns — one per screen, swiped through, with the next one
 * peeking so the pipeline still reads as a board. Dragging is replaced by the
 * stage picker on each card, which is both easier to hit than a drop zone and
 * reachable by assistive tech.
 *
 * The column title is hoisted out of the track and into a sticky bar: a
 * horizontal scroller is the sticky containing block for anything inside it, so
 * a header left in the column could never pin to the page. One column fills the
 * screen at a time, so the bar names whichever is in view. */
function MobileBoard({ guests, onStageChange }: MobileBoardProps) {
  const columns = groupGuestsByStage(guests);
  const options = GUEST_STAGES.map((stage) => ({ value: stage.id, label: stage.label }));
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  /* Which column is under the left edge of the track. Measured from the live
   * rects rather than `scrollLeft / width` so the track's padding and gaps
   * cannot drift the count out of step. */
  const syncActiveColumn = () => {
    const track = trackRef.current;
    if (!track) return;

    const trackLeft = track.getBoundingClientRect().left;
    let nearest = 0;
    let shortest = Number.POSITIVE_INFINITY;

    for (const [index, child] of Array.from(track.children).entries()) {
      const distance = Math.abs(child.getBoundingClientRect().left - trackLeft);
      if (distance < shortest) {
        shortest = distance;
        nearest = index;
      }
    }
    setActiveIndex(nearest);
  };

  const activeStage = GUEST_STAGES[activeIndex];
  const activeCount = columns[activeStage.id].length;

  return (
    <div className="md:hidden">
      {/* `top-0` pins the bar to the top of the scrolling content area — the
       * underside of the app header. The negative margin bleeds it to both
       * screen edges, and the spread-less shadow paints the strip of the
       * scroller's own padding above it, which the pinned bar does not cover
       * and cards would otherwise scroll through. */}
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-1.5 border-b border-line bg-canvas px-4 py-2.5 shadow-[0_-1rem_0_0_var(--color-canvas)]">
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: activeStage.accent }}
        />
        <h3 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          {activeStage.label}
        </h3>
        <span className="shrink-0 rounded-full bg-fill-strong px-1.5 text-[10px] font-semibold leading-4 text-ink-soft">
          {activeCount}
        </span>

        {/* Position in the pipeline — the swipe affordance the stacked list
         * used to get for free from having every stage on screen. */}
        <span aria-hidden className="ml-auto flex shrink-0 items-center gap-1">
          {GUEST_STAGES.map((stage, index) => (
            <span
              key={stage.id}
              className={`h-1 rounded-full transition-all ${
                index === activeIndex ? 'w-3 bg-ink-soft' : 'w-1 bg-line-strong'
              }`}
            />
          ))}
        </span>
      </div>

      {/* The negative margin lets the track bleed to the screen edges while the
       * padding keeps the first and last column on the content grid. */}
      <div
        ref={trackRef}
        onScroll={syncActiveColumn}
        className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2"
      >
        {GUEST_STAGES.map((stage) => {
          const stageGuests = columns[stage.id];

          return (
            <section
              key={stage.id}
              aria-label={columnLabel(stage.label, stageGuests.length)}
              className="flex w-[82%] max-w-xs shrink-0 snap-start flex-col rounded-2xl border border-line bg-sidebar p-2"
            >
              {stageGuests.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong px-3 py-8 text-center text-xs text-ink-muted">
                  No guests here yet
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {stageGuests.map((guest) => (
                    <article
                      key={guest.id}
                      className="rounded-xl border border-line bg-canvas p-3 shadow-sm"
                    >
                      {/* Only the top block is a link — the Select at the foot
                       * has to stay a plain interactive without a nested link
                       * eating its taps. */}
                      <Link
                        href={`/people/${guest.id}`}
                        className="-m-1 block rounded-lg p-1 transition-colors hover:bg-fill focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                      >
                        <h4 className="text-sm font-semibold leading-snug text-ink">
                          {fullName(guest)}
                        </h4>

                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: stage.soft, color: stage.accent }}
                          >
                            {visitSummary(guest)}
                          </span>
                          <span className="ml-auto">
                            <GuestAvatar guest={guest} size="md" />
                          </span>
                        </div>

                        {guest.invitedBy ? (
                          <p className="mt-2 truncate text-xs text-ink-muted">
                            Invited by {guest.invitedBy}
                          </p>
                        ) : null}
                      </Link>

                      <div className="mt-2.5 border-t border-line pt-2">
                        <Select
                          size="small"
                          className="w-full"
                          aria-label={`Stage for ${fullName(guest)}`}
                          value={guest.stage}
                          options={options}
                          onChange={(next: GuestStage) => onStageChange(guest, next)}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- board --- */

export function GuestKanban({ guests }: { guests: Guest[] }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [updateGuest] = useUpdateGuestMutation();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<GuestStage | null>(null);

  const columns = groupGuestsByStage(guests);

  const openGuest = (guest: Guest) => {
    router.push(`/people/${guest.id}`);
  };

  const moveGuest = async (guest: Guest, stage: GuestStage) => {
    if (guest.stage === stage) return;
    try {
      await updateGuest({ guestId: guest.id, stage }).unwrap();
    } catch {
      message.error(`Could not move ${fullName(guest)}`);
    }
  };

  const dropOn = (stage: GuestStage, guestId: string) => {
    setDropTarget(null);
    setDraggingId(null);
    const guest = guests.find((entry) => entry.id === guestId);
    if (guest) void moveGuest(guest, stage);
  };

  const moveByOffset = (guest: Guest, offset: number) => {
    const next = GUEST_STAGE_IDS[GUEST_STAGE_IDS.indexOf(guest.stage) + offset];
    if (next) void moveGuest(guest, next);
  };

  return (
    <>
      <div className="hidden grid-cols-2 gap-2 md:grid lg:grid-cols-3 xl:grid-cols-6">
        {GUEST_STAGES.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            guests={columns[stage.id]}
            draggingId={draggingId}
            isDropTarget={dropTarget === stage.id}
            onDragOverColumn={() => setDropTarget(stage.id)}
            onDragLeaveColumn={() =>
              setDropTarget((current) => (current === stage.id ? null : current))
            }
            onDropGuest={(guestId) => dropOn(stage.id, guestId)}
            onCardDragStart={setDraggingId}
            onCardDragEnd={() => {
              setDraggingId(null);
              setDropTarget(null);
            }}
            onMoveByOffset={moveByOffset}
            onOpenGuest={openGuest}
          />
        ))}
      </div>

      <MobileBoard guests={guests} onStageChange={(guest, stage) => void moveGuest(guest, stage)} />
    </>
  );
}
