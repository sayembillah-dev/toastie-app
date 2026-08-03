'use client';

import { MagnifyingGlass, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { Input } from 'antd';
import { useMemo, useState } from 'react';

import { GuestCard } from '@/components/people/guest-card';
import type { Guest } from '@/lib/people/guests';
import { useGetGuestsQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const GRID_CLASSES =
  'grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

function matchesQuery(guest: Guest, needle: string): boolean {
  const haystack =
    `${guest.firstName} ${guest.lastName} ${guest.email ?? ''} ${guest.invitedBy ?? ''}`.toLowerCase();
  return haystack.includes(needle);
}

function DirectorySkeleton() {
  return (
    <div className={GRID_CLASSES} aria-hidden>
      {Array.from({ length: 8 }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
          key={index}
          className="relative overflow-hidden rounded-xl border border-line bg-canvas"
        >
          <div className="h-16 animate-pulse bg-fill-strong" />
          <div className="absolute left-1/2 top-10 size-12 -translate-x-1/2 animate-pulse rounded-full bg-fill-strong ring-4 ring-canvas" />
          <div className="flex flex-col gap-2 px-3.5 pb-4 pt-9">
            <div className="mx-auto h-3 w-2/3 animate-pulse rounded bg-fill-strong" />
            <div className="mx-auto h-3 w-1/3 animate-pulse rounded bg-fill-strong" />
            <div className="mt-3 h-3 animate-pulse rounded bg-fill-strong" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GuestsDirectory() {
  const { data: guests, isLoading, isError, error } = useGetGuestsQuery();
  const [query, setQuery] = useState('');

  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!guests) return [];
    return trimmed ? guests.filter((guest) => matchesQuery(guest, trimmed)) : guests;
  }, [guests, trimmed]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Visitors who have dropped in to a meeting — keep in touch and invite them back.
        </p>
        <div className="w-full sm:w-72">
          <Input
            allowClear
            size="middle"
            placeholder="Search guests, emails, invitees"
            aria-label="Search guests"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
            disabled={isLoading}
          />
        </div>
      </div>

      {isLoading ? <DirectorySkeleton /> : null}

      {isError ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <WarningCircle size={18} weight="bold" />
          </span>
          <p className="text-sm font-medium text-ink">Could not load the guest list</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
            {trimmed ? (
              <>
                <p className="text-sm text-ink-soft">
                  No guests match{' '}
                  <span className="font-medium text-ink">&ldquo;{query}&rdquo;</span>.
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Try a different name, email, or inviter.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-soft">No guests logged yet.</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Add a guest after a meeting to keep in touch.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className={GRID_CLASSES}>
            {filtered.map((guest) => (
              <GuestCard key={guest.id} guest={guest} />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
