'use client';

import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { Input } from 'antd';
import { useMemo, useState, useSyncExternalStore } from 'react';

import { MemberCard } from '@/components/education/member-card';
import type { Member } from '@/lib/education/members';
import { membersStore } from '@/lib/education/members';

function matchesQuery(member: Member, needle: string): boolean {
  const haystack = `${member.firstName} ${member.lastName} ${member.role} ${member.pathway}`.toLowerCase();
  return haystack.includes(needle);
}

/** Renders the members grid with a filter input. SSR uses the seed snapshot;
 * the client subscribes to localStorage so cross-tab edits stay in sync. */
export function MembersDirectory() {
  const members = useSyncExternalStore(
    membersStore.subscribe,
    membersStore.getSnapshot,
    membersStore.getServerSnapshot,
  );
  const [query, setQuery] = useState('');

  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (trimmed ? members.filter((member) => matchesQuery(member, trimmed)) : members),
    [members, trimmed],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink">Members</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Toastmasters club roster with each member&apos;s Pathways progress.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            allowClear
            size="middle"
            placeholder="Search members, roles, pathways"
            aria-label="Search members"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <p className="text-sm text-ink-soft">
            No members match <span className="font-medium text-ink">&ldquo;{query}&rdquo;</span>.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Try a different name, role, or pathway.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}
