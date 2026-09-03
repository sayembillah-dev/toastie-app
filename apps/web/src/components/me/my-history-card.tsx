'use client';

import { CaretRight, ClockCounterClockwise } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

/** Entry point to `/me/history` — the cross-club timeline composed from the
 * shared `Person` behind this account's number. Guest-era visits recorded
 * before the account (or the membership) existed belong there, so the card
 * sits on the Me page even though everything around it is club-scoped. */
export function MyHistoryCard() {
  return (
    <Link
      href="/me/history"
      className="group flex items-center gap-3 rounded-xl border border-line bg-canvas p-4 transition-colors hover:border-line-strong hover:bg-sidebar"
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill text-ink"
      >
        <ClockCounterClockwise size={17} weight="bold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">My history</span>
        <span className="mt-0.5 block text-xs text-ink-muted">
          Everywhere your number has been — including visits from before you joined.
        </span>
      </span>
      <CaretRight
        size={15}
        aria-hidden
        className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
