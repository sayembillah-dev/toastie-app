'use client';

import {
  ArrowCounterClockwise,
  Info,
  MagnifyingGlass,
  ShieldCheck,
} from '@phosphor-icons/react/dist/ssr';
import type { Action, ResourceKey } from '@toastly/access';
import { ACTIONS, can as canDecide, overrideKey, RESOURCE_KEYS } from '@toastly/access';
import { App, Button, Checkbox, Input, Select, Skeleton } from 'antd';
import { useMemo, useState } from 'react';

import type { Member } from '@/lib/education/members';
import { formatRoles, getInitials } from '@/lib/education/members';
import { otherMemberToSubject } from '@/lib/permissions/subject';
import { useGetMembersQuery, useSetMemberPermissionsMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppSelector } from '@/store/hooks';
import { selectActiveContextKey, selectSessionMemberships } from '@/store/session-slice';

/** Every resource key gets a display row on the grid. `report` and `orgUnit`
 * appear alongside club resources so a Club Admin can see the full surface,
 * even though granting them at this level has no effect (the engine clamps
 * a club-anchored allow-override down to `club` scope). */
const RESOURCE_LABELS: Record<ResourceKey, string> = {
  user: 'User accounts',
  club: 'Club',
  member: 'Members — directory',
  memberRole: 'Members — roles',
  memberPermission: 'Members — permissions',
  education: 'Education',
  meeting: 'Meetings',
  meetingRole: 'Meeting roles',
  checklist: 'SAA checklist',
  guest: 'Guests',
  guestLog: 'Guest log',
  library: 'Library',
  inventory: 'Inventory',
  transaction: 'Finance — transactions',
  budget: 'Finance — budgets',
  dues: 'Finance — dues',
  evaluation: 'Evaluations',
  speechRequest: 'Speech requests',
  task: 'Meeting tasks',
  activityLog: 'Activity log',
  invite: 'Invites',
  joinRequest: 'Join requests',
  orgUnit: 'Org unit',
  orgAssignment: 'Org assignments (Director roles)',
  report: 'Reports',
};

const ACTION_LABELS: Record<Action, string> = {
  create: 'Create',
  read: 'Read',
  update: 'Update',
  delete: 'Delete',
};

/** What one cell of the grid needs to render and to write back. */
interface Cell {
  key: string;
  /** What the checkbox shows — the member's effective access today. */
  checked: boolean;
  /** What the member's roles alone would grant, ignoring every override.
   * Toggling a box back to this value clears the override instead of
   * writing the opposite one, so the cell resumes following the role. */
  roleAllows: boolean;
}

interface Row {
  resource: ResourceKey;
  label: string;
  cells: Record<Action, Cell>;
}

/** Per-member, per-resource×action permission grid.
 *
 * The stored model is tri-state (`allow` / `deny` / absent = follow the
 * role), but the grid presents it as a plain checkbox: ticked means the
 * member can do it, unticked means they cannot. The third state stays
 * meaningful underneath — ticking a box back to whatever the member's roles
 * already grant clears the override rather than pinning an explicit one, so
 * the cell keeps tracking the role if that role's grants ever change. The
 * header counts how many cells disagree with the role, and Reset clears
 * them in one write.
 *
 * Club Admins bypass this entirely (their role grants full access to every
 * club resource), so the grid is replaced with an explanatory panel. */
export function PermissionsTab() {
  const { message } = App.useApp();
  const { data: members, isLoading } = useGetMembersQuery();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [setPermissions, { isLoading: isSaving }] = useSetMemberPermissionsMutation();

  const memberOptions = useMemo(
    () =>
      (members ?? [])
        .slice()
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
        )
        .map((member) => ({
          value: member.id,
          label: `${member.firstName} ${member.lastName}`,
        })),
    [members],
  );

  const selected = useMemo(
    () => (members ?? []).find((member) => member.id === memberId) ?? null,
    [members, memberId],
  );

  const memberships = useAppSelector(selectSessionMemberships);
  const contextKey = useAppSelector(selectActiveContextKey);
  const activeClubId = contextKey?.startsWith('club:') ? contextKey.slice('club:'.length) : null;
  // The edited member lives in the current club — pull lineage from the
  // caller's own membership so the preview subject can answer director
  // scope-anchored questions the same way the API would.
  const currentClubLineage = useMemo(() => {
    const own = memberships.find((m) => m.clubId === activeClubId);
    return own?.lineage ?? {};
  }, [memberships, activeClubId]);

  /* Two subjects, both fed through the same engine the runtime chokepoint
   * uses. The first carries the member's overrides and answers "what can
   * they do today?" — that's the checkbox. The second strips the overrides
   * and answers "what would their roles alone give them?" — that's what a
   * toggle is compared against to decide between clearing the override and
   * writing an explicit one. */
  const rows = useMemo<Row[]>(() => {
    if (!selected || !activeClubId) return [];
    const withOverrides = otherMemberToSubject(selected, currentClubLineage);
    const rolesOnly = otherMemberToSubject({ ...selected, overrides: {} }, currentClubLineage);
    /* `ownerMembershipId` makes `own`-scoped grants (a member reading their
     * own tasks or evaluations) resolve truthfully instead of reading as a
     * blanket deny — the grid is asking about this member's own reach. */
    const target = { clubId: activeClubId, ownerMembershipId: selected.id };

    return RESOURCE_KEYS.map((resource) => {
      const cells = {} as Record<Action, Cell>;
      for (const action of ACTIONS) {
        const key = overrideKey(resource, action);
        cells[action] = {
          key,
          checked: canDecide(withOverrides, action, resource, target),
          roleAllows: canDecide(rolesOnly, action, resource, target),
        };
      }
      return { resource, label: RESOURCE_LABELS[resource], cells };
    });
  }, [selected, activeClubId, currentClubLineage]);

  const visibleRows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.label.toLowerCase().includes(needle));
  }, [rows, filter]);

  const customisedCount = useMemo(() => Object.keys(selected?.overrides ?? {}).length, [selected]);

  async function handleToggle(cell: Cell, nextChecked: boolean) {
    if (!selected) return;
    /* Landing back on the role default clears the override — that keeps the
     * stored map free of entries that only restate the role, and lets the
     * cell follow along if the member's roles change later. */
    const value = nextChecked === cell.roleAllows ? 'default' : nextChecked ? 'allow' : 'deny';
    try {
      await setPermissions({ memberId: selected.id, overrides: { [cell.key]: value } }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this permission'));
    }
  }

  async function handleReset() {
    if (!selected) return;
    const overrides = Object.fromEntries(
      Object.keys(selected.overrides ?? {}).map((key) => [key, 'default' as const]),
    );
    if (Object.keys(overrides).length === 0) return;
    try {
      await setPermissions({ memberId: selected.id, overrides }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not reset these permissions'));
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl rounded-2xl border border-line bg-canvas p-4">
        <Skeleton active title={false} paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Select
        className="w-full sm:w-80"
        size="large"
        placeholder="Select a member"
        value={memberId ?? undefined}
        onChange={setMemberId}
        options={memberOptions}
        showSearch
        optionFilterProp="label"
        suffixIcon={<MagnifyingGlass size={16} />}
      />

      {!selected ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
          <p className="text-sm text-ink-soft">Pick a member to view or edit their permissions.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-canvas">
          <MemberHeader
            member={selected}
            customisedCount={customisedCount}
            resetting={isSaving}
            onReset={handleReset}
          />

          {selected.isClubAdmin ? (
            <div className="flex items-start gap-2 p-4 text-sm text-ink-soft">
              <ShieldCheck size={16} weight="bold" className="mt-0.5 shrink-0 text-ink-muted" />
              <span>
                Club Admins have full access to every resource in the club. Remove their Club Admin
                rights from the Members tab to set individual permissions instead.
              </span>
            </div>
          ) : (
            <>
              <div className="border-b border-line px-3 py-2.5 sm:px-4">
                <Input
                  allowClear
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Filter resources"
                  prefix={<MagnifyingGlass size={15} className="text-ink-muted" />}
                />
              </div>

              {visibleRows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-ink-muted">
                  No resources match &ldquo;{filter.trim()}&rdquo;.
                </p>
              ) : (
                <>
                  <DesktopGrid rows={visibleRows} onToggle={handleToggle} />
                  <MobileList rows={visibleRows} onToggle={handleToggle} />
                </>
              )}
            </>
          )}
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted">
        <Info size={13} weight="bold" className="mt-0.5 shrink-0" />
        Ticked means the member can do it. Changes apply immediately and are enforced across the
        app, not just recorded here.
      </p>
    </div>
  );
}

function MemberHeader({
  member,
  customisedCount,
  resetting,
  onReset,
}: {
  member: Member;
  customisedCount: number;
  resetting: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line p-3 sm:p-4">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-semibold text-ink-soft"
      >
        {getInitials(member)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {member.firstName} {member.lastName}
        </p>
        <p className="truncate text-xs text-ink-muted">{formatRoles(member)}</p>
      </div>
      {customisedCount > 0 ? (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-fill px-2 py-0.5 text-xs font-medium text-ink-soft">
            {customisedCount} custom
          </span>
          <Button
            size="small"
            icon={<ArrowCounterClockwise size={13} />}
            loading={resetting}
            onClick={onReset}
          >
            Reset
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface GridProps {
  rows: Row[];
  onToggle: (cell: Cell, nextChecked: boolean) => void;
}

/** md and up: a real table so the four columns line up across 25 rows and
 * the header can stick while the list scrolls. */
function DesktopGrid({ rows, onToggle }: GridProps) {
  return (
    <div className="hidden md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
            <th scope="col" className="px-4 py-2.5 font-medium">
              Resource
            </th>
            {ACTIONS.map((action) => (
              <th key={action} scope="col" className="w-24 px-3 py-2.5 text-center font-medium">
                {ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.resource}
              className="border-b border-line transition-colors last:border-b-0 hover:bg-fill/50"
            >
              <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
                {row.label}
              </th>
              {ACTIONS.map((action) => (
                <td key={action} className="px-3 py-2 text-center">
                  <PermissionBox
                    cell={row.cells[action]}
                    label={`${ACTION_LABELS[action]} — ${row.label}`}
                    onToggle={onToggle}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Below md: one card per resource with the four actions as labelled
 * checkboxes in a two-up grid. A 5-column table is unusable at phone
 * widths — this keeps every control at a comfortable tap size without
 * horizontal scrolling. */
function MobileList({ rows, onToggle }: GridProps) {
  return (
    <ul className="divide-y divide-line md:hidden">
      {rows.map((row) => (
        <li key={row.resource} className="px-3 py-3">
          <p className="text-sm font-medium text-ink">{row.label}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {ACTIONS.map((action) => (
              <PermissionBox
                key={action}
                cell={row.cells[action]}
                label={`${ACTION_LABELS[action]} — ${row.label}`}
                text={ACTION_LABELS[action]}
                onToggle={onToggle}
              />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The checkbox for one resource×action cell.
 *
 * `text` is the mobile form: antd renders its own `<label>` around the
 * control, so the visible label has to go through `children` rather than an
 * outer label of ours, which would nest two labels around one input. */
function PermissionBox({
  cell,
  label,
  text,
  onToggle,
}: {
  cell: Cell;
  label: string;
  text?: string;
  onToggle: (cell: Cell, nextChecked: boolean) => void;
}) {
  const handleChange = (checked: boolean) => onToggle(cell, checked);

  if (text) {
    return (
      <Checkbox
        checked={cell.checked}
        onChange={(event) => handleChange(event.target.checked)}
        className="!items-center py-1.5 text-ink-soft"
      >
        {text}
      </Checkbox>
    );
  }

  return (
    <Checkbox
      checked={cell.checked}
      aria-label={label}
      onChange={(event) => handleChange(event.target.checked)}
    />
  );
}
