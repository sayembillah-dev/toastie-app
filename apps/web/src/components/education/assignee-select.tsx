'use client';

import { UserCircle, UserPlus } from '@phosphor-icons/react/dist/ssr';
import { Select } from 'antd';
import { useMemo, useState } from 'react';

import type { Member } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';

interface AssigneeSelectProps {
  value: Assignee | null;
  onChange: (next: Assignee | null) => void;
  members: Member[];
  placeholder?: string;
  ariaLabel?: string;
}

/** Serialise the union into a single Select value; the `m:` / `g:` prefix keeps
 * member IDs from clashing with typed guest names. */
function toKey(a: Assignee | null): string | undefined {
  if (!a) return undefined;
  return a.kind === 'member' ? `m:${a.memberId}` : `g:${a.name}`;
}

/** A single control that either picks a club member from the roster or promotes
 * whatever the user typed into a one-off guest. Typing a name that doesn't
 * match anyone reveals an "Add … as guest" row at the bottom of the dropdown,
 * so both flows live in one keyboard-navigable list. */
export function AssigneeSelect({
  value,
  onChange,
  members,
  placeholder = 'Assign…',
  ariaLabel,
}: AssigneeSelectProps) {
  const [search, setSearch] = useState('');
  const trimmed = search.trim();
  const needle = trimmed.toLowerCase();

  const options = useMemo(() => {
    const memberMatches = members
      .filter((m) => {
        if (!needle) return true;
        return `${m.firstName} ${m.lastName}`.toLowerCase().includes(needle);
      })
      .map((m) => ({
        value: `m:${m.id}`,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <UserCircle size={12} weight="bold" className="text-ink-muted" />
            {m.firstName} {m.lastName}
          </span>
        ),
      }));

    const opts: Array<{ value: string; label: React.ReactNode }> = [...memberMatches];

    /* If nothing in the roster matches, offer to add the query as a guest so a
     * VPE assigning someone new doesn't need to leave the row to add them. */
    if (trimmed && memberMatches.length === 0) {
      opts.push({
        value: `g:${trimmed}`,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <UserPlus size={12} weight="bold" className="text-ink-muted" />
            Add <span className="font-medium">&ldquo;{trimmed}&rdquo;</span> as guest
          </span>
        ),
      });
    }

    /* A guest that was set earlier won't appear in the roster, so seed it back
     * into the option list to keep the collapsed label rendering the name. */
    if (value?.kind === 'guest') {
      const guestKey = `g:${value.name}`;
      if (!opts.some((o) => o.value === guestKey)) {
        opts.unshift({
          value: guestKey,
          label: (
            <span className="inline-flex items-center gap-1.5">
              <UserPlus size={12} weight="bold" className="text-ink-muted" />
              {value.name}
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">Guest</span>
            </span>
          ),
        });
      }
    }

    return opts;
  }, [members, needle, trimmed, value]);

  return (
    <Select
      variant="borderless"
      size="small"
      className="planner-assignee-select w-full"
      value={toKey(value)}
      showSearch
      allowClear
      placeholder={placeholder}
      aria-label={ariaLabel}
      onSearch={setSearch}
      onDropdownVisibleChange={(open) => {
        if (!open) setSearch('');
      }}
      /* We filter in `options` above so the "add as guest" row can appear even
       * when nothing matches — antd's own filter would hide it. */
      filterOption={false}
      options={options}
      onChange={(next: string | undefined) => {
        if (!next) return onChange(null);
        if (next.startsWith('m:')) {
          onChange({ kind: 'member', memberId: next.slice(2) });
        } else {
          onChange({ kind: 'guest', name: next.slice(2) });
        }
      }}
    />
  );
}
