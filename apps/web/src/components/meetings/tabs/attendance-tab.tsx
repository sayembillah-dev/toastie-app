'use client';

import { MagnifyingGlass, TrashSimple, UserPlus, X } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Checkbox, Input, Skeleton } from 'antd';
import { useMemo, useState } from 'react';

import { getPrimaryRole } from '@/lib/education/members';
import {
  useCreateAttendanceGuestMutation,
  useDeleteAttendanceGuestMutation,
  useGetAttendanceGuestsQuery,
  useGetAttendanceMembersQuery,
  useGetMembersQuery,
  useMarkAllAttendanceMutation,
  useSetAttendanceMemberMutation,
  useUpdateAttendanceGuestMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface RosterRow {
  id: string;
  name: string;
  role: string;
  present: boolean;
  isGuest: boolean;
}

interface AttendanceRowProps {
  row: RosterRow;
  onToggle: () => void;
  onRemove?: () => void;
}

/** Single tap-target row. The whole row is a button so tapping anywhere on
 * the name toggles the checkbox — matters on phones where the checkbox
 * itself is a small hit area. The trash button stops propagation so removing
 * a guest doesn't also flip their attendance on the way out. */
function AttendanceRow({ row, onToggle, onRemove }: AttendanceRowProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border transition-colors ${
        row.present ? 'border-line-strong bg-fill' : 'border-line bg-canvas hover:bg-fill/60'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={row.present}
        aria-label={`Mark ${row.name} present`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        {/* Non-interactive — the surrounding button owns the click, so the
         * checkbox stays a visual indicator to avoid double-toggling. */}
        <Checkbox checked={row.present} tabIndex={-1} className="pointer-events-none" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{row.name}</div>
          <div className="text-xs text-ink-muted">{row.role}</div>
        </div>
      </button>
      {onRemove ? (
        <div className="pr-2">
          <Button
            type="text"
            size="small"
            aria-label={`Remove ${row.name}`}
            icon={<TrashSimple size={16} className="text-ink-muted" />}
            onClick={onRemove}
          />
        </div>
      ) : null}
    </div>
  );
}

interface GuestFormProps {
  onCommit: (name: string) => void;
  onCancel: () => void;
}

function GuestForm({ onCommit, onCancel }: GuestFormProps) {
  const [draft, setDraft] = useState('');

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onCommit(trimmed);
    setDraft('');
  }

  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-sidebar p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          className="min-w-0 flex-1"
          size="large"
          value={draft}
          maxLength={80}
          placeholder="Guest name"
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <div className="flex items-center gap-2 sm:shrink-0">
          <Button type="primary" onClick={commit} disabled={!draft.trim()}>
            Add
          </Button>
          <Button
            type="text"
            aria-label="Cancel adding guest"
            icon={<X size={16} className="text-ink-muted" />}
            onClick={onCancel}
          />
        </div>
      </div>
    </div>
  );
}

interface AttendanceTabProps {
  meetingId: string;
}

/** Attendance tab — the club roster with a checkbox per member, plus a
 * secondary section for guests. Search filters both. Every check-in saves
 * immediately — no Save button, matching the Checklist tab. */
export function AttendanceTab({ meetingId }: AttendanceTabProps) {
  const { message } = App.useApp();
  const { data: members, isLoading: membersLoading } = useGetMembersQuery();
  const {
    data: attendanceRows,
    isLoading: attendanceLoading,
    isError: attendanceError,
    error: attendanceErrorDetail,
  } = useGetAttendanceMembersQuery(meetingId);
  const {
    data: guests,
    isLoading: guestsLoading,
    isError: guestsError,
    error: guestsErrorDetail,
  } = useGetAttendanceGuestsQuery(meetingId);

  const [setMemberAttendance] = useSetAttendanceMemberMutation();
  const [createGuest] = useCreateAttendanceGuestMutation();
  const [updateGuest] = useUpdateAttendanceGuestMutation();
  const [deleteGuest] = useDeleteAttendanceGuestMutation();
  const [markAll, { isLoading: isMarkingAll }] = useMarkAllAttendanceMutation();

  const [query, setQuery] = useState('');
  const [addingGuest, setAddingGuest] = useState(false);

  const presentById = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const row of attendanceRows ?? []) map[row.membershipId] = row.present;
    return map;
  }, [attendanceRows]);

  const memberRows = useMemo<RosterRow[]>(
    () =>
      (members ?? [])
        .map((member) => ({
          id: member.id,
          name: `${member.firstName} ${member.lastName}`,
          role: getPrimaryRole(member),
          present: presentById[member.id] ?? false,
          isGuest: false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members, presentById],
  );

  const guestRows = useMemo<RosterRow[]>(
    () =>
      (guests ?? []).map((guest) => ({
        id: guest.id,
        name: guest.name,
        role: 'Guest',
        present: guest.present,
        isGuest: true,
      })),
    [guests],
  );

  const isLoading = membersLoading || attendanceLoading || guestsLoading;

  if (isLoading) {
    return (
      <section className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
          <Skeleton active title paragraph={{ rows: 5 }} />
        </div>
      </section>
    );
  }

  if (attendanceError || guestsError) {
    return (
      <section className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-dashed border-line-strong bg-canvas p-6 text-center">
          <p className="text-sm font-medium text-ink">Could not load attendance</p>
          <p className="mt-1 text-xs text-ink-muted">
            {getApiErrorMessage(attendanceErrorDetail ?? guestsErrorDetail)}
          </p>
        </div>
      </section>
    );
  }

  const needle = query.trim().toLowerCase();
  const matches = (row: RosterRow) => needle === '' || row.name.toLowerCase().includes(needle);

  const filteredMembers = memberRows.filter(matches);
  const filteredGuests = guestRows.filter(matches);

  const presentMembers = memberRows.reduce((count, row) => count + (row.present ? 1 : 0), 0);
  const presentGuests = guestRows.reduce((count, row) => count + (row.present ? 1 : 0), 0);
  const totalPresent = presentMembers + presentGuests;
  const totalRoster = memberRows.length + guestRows.length;

  async function handleToggleMember(id: string) {
    try {
      await setMemberAttendance({
        meetingId,
        membershipId: id,
        present: !(presentById[id] ?? false),
      }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update attendance'));
    }
  }

  async function handleToggleGuest(id: string) {
    const guest = guestRows.find((row) => row.id === id);
    if (!guest) return;
    try {
      await updateGuest({ meetingId, guestId: id, present: !guest.present }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update attendance'));
    }
  }

  async function handleAddGuest(name: string) {
    try {
      await createGuest({ meetingId, name }).unwrap();
      setAddingGuest(false);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not add the guest'));
    }
  }

  async function handleRemoveGuest(id: string) {
    try {
      await deleteGuest({ meetingId, guestId: id }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not remove the guest'));
    }
  }

  async function handleMarkAll(present: boolean) {
    try {
      await markAll({ meetingId, present }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update attendance'));
    }
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Attendance</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Check off each member as they arrive. Add guests for non-roster attendees.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-fill px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
            {totalPresent}/{totalRoster} present
          </span>
        </header>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            size="large"
            className="min-w-0 flex-1"
            allowClear
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search members or guests"
            prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
          />
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button
              size="large"
              loading={isMarkingAll}
              onClick={() => handleMarkAll(true)}
              disabled={totalRoster === 0 || totalPresent === totalRoster}
            >
              Mark all
            </Button>
            <Button
              size="large"
              loading={isMarkingAll}
              onClick={() => handleMarkAll(false)}
              disabled={totalPresent === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Members
          </span>
          <span className="text-[11px] text-ink-muted">
            {presentMembers}/{memberRows.length} present
          </span>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">
              {memberRows.length === 0 ? 'No members yet' : 'No matches'}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {memberRows.length === 0
                ? 'Add members from the roster page to check them in here.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredMembers.map((row) => (
              <AttendanceRow key={row.id} row={row} onToggle={() => handleToggleMember(row.id)} />
            ))}
          </div>
        )}

        <div className="mb-3 mt-6 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Guests
          </span>
          <span className="text-[11px] text-ink-muted">
            {presentGuests}/{guestRows.length} present
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {filteredGuests.map((row) => (
            <AttendanceRow
              key={row.id}
              row={row}
              onToggle={() => handleToggleGuest(row.id)}
              onRemove={() => handleRemoveGuest(row.id)}
            />
          ))}

          {addingGuest ? (
            <GuestForm onCommit={handleAddGuest} onCancel={() => setAddingGuest(false)} />
          ) : (
            <Button
              block
              size="large"
              type="dashed"
              icon={<UserPlus size={16} weight="bold" />}
              onClick={() => setAddingGuest(true)}
            >
              Add guest
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
