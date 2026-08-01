'use client';

import { MagnifyingGlass, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { Input } from 'antd';
import { useMemo } from 'react';

import { MemberCard } from '@/components/education/member-card';
import type { Member } from '@/lib/education/members';
import { useGetMembersQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { memberSearchQueryChanged, selectMemberSearchQuery } from '@/store/ui-slice';

const GRID_CLASSES =
  'grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

function matchesQuery(member: Member, needle: string): boolean {
  const haystack = `${member.firstName} ${member.lastName} ${member.role} ${member.pathway ?? ''}`.toLowerCase();
  return haystack.includes(needle);
}

/** Mirrors the card's banner/avatar/body rhythm so the grid does not reflow when
 * the real data lands. */
function DirectorySkeleton() {
  return (
    <div className={GRID_CLASSES} aria-hidden>
      {Array.from({ length: 10 }, (_, index) => (
        <div
          key={index}
          className="relative overflow-hidden rounded-xl border border-line bg-canvas"
        >
          <div className="h-16 animate-pulse bg-fill-strong" />
          <div className="absolute left-1/2 top-10 size-12 -translate-x-1/2 animate-pulse rounded-full bg-fill-strong ring-4 ring-canvas" />
          <div className="flex flex-col gap-2 px-3.5 pb-4 pt-9">
            <div className="h-3 animate-pulse rounded bg-fill-strong" />
            <div className="mx-auto h-3 w-2/3 animate-pulse rounded bg-fill-strong" />
            <div className="mx-auto h-3 w-1/3 animate-pulse rounded bg-fill-strong" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Renders the members grid with a filter input. The roster comes from RTK Query
 * — today the base query serves it out of localStorage, later out of the API. */
export function MembersDirectory() {
  const { data: members, isLoading, isError, error } = useGetMembersQuery();
  const dispatch = useAppDispatch();
  const query = useAppSelector(selectMemberSearchQuery);

  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!members) return [];
    return trimmed ? members.filter((member) => matchesQuery(member, trimmed)) : members;
  }, [members, trimmed]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Toastmasters club roster with each member&apos;s Pathways progress.
        </p>
        <div className="w-full sm:w-72">
          <Input
            allowClear
            size="middle"
            placeholder="Search members, roles, pathways"
            aria-label="Search members"
            value={query}
            onChange={(event) => dispatch(memberSearchQueryChanged(event.target.value))}
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
          <p className="text-sm font-medium text-ink">Could not load the roster</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
            {trimmed ? (
              <>
                <p className="text-sm text-ink-soft">
                  No members match{' '}
                  <span className="font-medium text-ink">&ldquo;{query}&rdquo;</span>.
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Try a different name, role, or pathway.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-soft">No members in the club yet.</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Add a member to start tracking Pathways progress.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className={GRID_CLASSES}>
            {filtered.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
