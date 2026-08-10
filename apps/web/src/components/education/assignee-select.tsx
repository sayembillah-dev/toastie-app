'use client';

import { UserCircle, UserPlus } from '@phosphor-icons/react/dist/ssr';
import { Select } from 'antd';
import { useMemo, useState } from 'react';

import type { Member } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';

interface GuestOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface AssigneeSelectProps {
  value: Assignee | null;
  onChange: (next: Assignee | null) => void;
  members: Member[];
  /** Real guests from the club's Guests roster — shown in their own group
   * below Members, separated by antd's group-label divider. Any guest, not
   * just members, can hold a role or a prepared speech slot. */
  guests?: GuestOption[];
  placeholder?: string;
  ariaLabel?: string;
  /** Whether typing a name with no roster match offers "Add … as guest".
   * That guest has no id anything on the meeting side can link to (see
   * `lib/meetings/from-planner.ts`), so pickers that write straight to a
   * meeting's roles/speakers (Roles tab, Prepared Speakers tab) turn this
   * off — the planner grid, which only ever writes to itself, leaves it on. */
  allowFreeformGuest?: boolean;
}

/** Serialise the union into a single Select value. `m:` is a member id,
 * `gid:` a roster guest's id, `g:` a typed, not-in-the-roster guest name —
 * three disjoint prefixes so `onChange` can tell them apart unambiguously. */
function toKey(a: Assignee | null): string | undefined {
  if (!a) return undefined;
  if (a.kind === 'member') return `m:${a.memberId}`;
  return a.guestId ? `gid:${a.guestId}` : `g:${a.name}`;
}

/** A single control that picks a club member or a guest from the roster, or —
 * where allowed — promotes whatever was typed into a one-off guest. Typing a
 * name that matches nobody reveals an "Add … as guest" row at the bottom of
 * the dropdown, so every flow lives in one keyboard-navigable list. Members
 * and guests render as two labelled groups, the group header standing in for
 * a divider between them. */
export function AssigneeSelect({
  value,
  onChange,
  members,
  guests = [],
  placeholder = 'Assign…',
  ariaLabel,
  allowFreeformGuest = true,
}: AssigneeSelectProps) {
  const [search, setSearch] = useState('');
  const trimmed = search.trim();
  const needle = trimmed.toLowerCase();

  const groupedOptions = useMemo(() => {
    const memberOptions = members
      .filter((m) => !needle || `${m.firstName} ${m.lastName}`.toLowerCase().includes(needle))
      .map((m) => ({
        value: `m:${m.id}`,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <UserCircle size={12} weight="bold" className="text-ink-muted" />
            {m.firstName} {m.lastName}
          </span>
        ),
      }));

    const guestOptions = guests
      .filter((g) => !needle || `${g.firstName} ${g.lastName}`.toLowerCase().includes(needle))
      .map((g) => ({
        value: `gid:${g.id}`,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <UserPlus size={12} weight="bold" className="text-ink-muted" />
            {g.firstName} {g.lastName}
          </span>
        ),
      }));

    /* If nothing in either roster matches, offer to add the query as a
     * one-off guest so a VPE assigning someone brand new doesn't need to
     * leave the field to add them first. */
    if (allowFreeformGuest && trimmed && guestOptions.length === 0) {
      guestOptions.push({
        value: `g:${trimmed}`,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <UserPlus size={12} weight="bold" className="text-ink-muted" />
            Add <span className="font-medium">&ldquo;{trimmed}&rdquo;</span> as guest
          </span>
        ),
      });
    }

    /* A guest picked earlier might not appear in the current roster/search
     * result — seed it back in so the collapsed control still renders its
     * name (a roster guest who was later removed, or a typed guest once the
     * search clears). */
    const currentKey = toKey(value);
    if (value?.kind === 'guest' && currentKey) {
      const alreadyShown = guestOptions.some((o) => o.value === currentKey);
      if (!alreadyShown) {
        guestOptions.unshift({
          value: currentKey,
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

    const groups: Array<{ label: string; options: typeof memberOptions }> = [];
    if (memberOptions.length > 0) groups.push({ label: 'Members', options: memberOptions });
    if (guestOptions.length > 0) groups.push({ label: 'Guests', options: guestOptions });
    return groups;
  }, [members, guests, needle, trimmed, value, allowFreeformGuest]);

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
      onOpenChange={(open) => {
        if (!open) setSearch('');
      }}
      /* We filter in `groupedOptions` above so the "add as guest" row can
       * appear even when nothing matches — antd's own filter would hide it. */
      filterOption={false}
      options={groupedOptions}
      onChange={(next: string | undefined) => {
        if (!next) return onChange(null);
        if (next.startsWith('m:')) {
          onChange({ kind: 'member', memberId: next.slice(2) });
          return;
        }
        if (next.startsWith('gid:')) {
          const guestId = next.slice(4);
          const guest = guests.find((g) => g.id === guestId);
          onChange({
            kind: 'guest',
            guestId,
            name: guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown guest',
          });
          return;
        }
        onChange({ kind: 'guest', name: next.slice(2) });
      }}
    />
  );
}
