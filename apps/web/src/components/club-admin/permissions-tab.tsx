'use client';

import { Info, MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import type { Action, ResourceKey } from '@toastly/access';
import { ACTIONS, can as canDecide, overrideKey, RESOURCE_KEYS } from '@toastly/access';
import { App, Segmented, Select, Skeleton } from 'antd';
import { useMemo, useState } from 'react';

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

const SEGMENT_OPTIONS = [
  { label: 'Default', value: 'default' as const },
  { label: 'Allow', value: 'allow' as const },
  { label: 'Deny', value: 'deny' as const },
];

/** Per-member, per-resource×action override matrix. Every cell shows one of
 * three states — Default (fall through to the role-based grant), Allow, or
 * Deny — the same three states the engine's `overrides` map understands.
 * Club Admins bypass this entirely (their role grants full access to every
 * club resource), so the matrix is disabled with an explanatory panel. */
export function PermissionsTab() {
  const { message } = App.useApp();
  const { data: members, isLoading } = useGetMembersQuery();
  const [memberId, setMemberId] = useState<string | null>(null);
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

  /* Preview the effective allow/deny for every cell using the same subject
   * builder + engine the runtime chokepoint uses. That way a Club Admin
   * setting "Default" on a role-granted action can see the cell resolve
   * to a green baseline, and the same subject that answers "can this run?"
   * on the wire answers "what's the baseline?" on this grid. */
  const subject = useMemo(
    () => (selected ? otherMemberToSubject(selected, currentClubLineage) : null),
    [selected, currentClubLineage],
  );

  async function handleChange(
    resource: ResourceKey,
    action: Action,
    next: 'default' | 'allow' | 'deny',
  ) {
    if (!selected) return;
    try {
      await setPermissions({
        memberId: selected.id,
        overrides: { [overrideKey(resource, action)]: next },
      }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this permission'));
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl rounded-xl border border-line bg-canvas p-4">
        <Skeleton active title={false} paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-center gap-2">
        <span aria-hidden className="text-ink-muted">
          <MagnifyingGlass size={16} />
        </span>
        <Select
          className="w-72"
          placeholder="Select a member"
          value={memberId ?? undefined}
          onChange={setMemberId}
          options={memberOptions}
          showSearch
          optionFilterProp="label"
        />
      </div>

      {!selected ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <p className="text-sm text-ink-soft">Pick a member to view or edit their permissions.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-canvas">
          <div className="flex items-center gap-3 border-b border-line p-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-semibold text-ink-soft"
            >
              {getInitials(selected)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {selected.firstName} {selected.lastName}
              </p>
              <p className="truncate text-xs text-ink-muted">{formatRoles(selected)}</p>
            </div>
          </div>

          {selected.isClubAdmin ? (
            <div className="flex items-start gap-2 p-4 text-sm text-ink-soft">
              <ShieldCheck size={16} weight="bold" className="mt-0.5 shrink-0 text-ink-muted" />
              <span>
                Club Admins have full access to every resource in the club. Remove their Club Admin
                rights from the Members tab to set individual permissions instead.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-3 py-2 font-medium">Resource</th>
                    {ACTIONS.map((action) => (
                      <th key={action} className="px-3 py-2 font-medium">
                        {ACTION_LABELS[action]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCE_KEYS.map((resource) => (
                    <tr key={resource} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-2.5 text-ink">{RESOURCE_LABELS[resource]}</td>
                      {ACTIONS.map((action) => {
                        const key = overrideKey(resource, action);
                        const current: 'default' | 'allow' | 'deny' =
                          selected.overrides?.[key] ?? 'default';
                        /* Show a subtle baseline chip when the current cell is
                         * Default so an admin can see whether the role grant
                         * already covers it. */
                        const baselineAllowed =
                          subject && activeClubId
                            ? canDecide(subject, action, resource, { clubId: activeClubId })
                            : false;
                        return (
                          <td key={action} className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <Segmented
                                size="small"
                                value={current}
                                disabled={isSaving}
                                options={SEGMENT_OPTIONS}
                                onChange={(value) =>
                                  void handleChange(
                                    resource,
                                    action,
                                    value as 'default' | 'allow' | 'deny',
                                  )
                                }
                              />
                              {current === 'default' ? (
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                    baselineAllowed
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-red-50 text-red-700'
                                  }`}
                                  title="Role default"
                                >
                                  {baselineAllowed ? 'role: allow' : 'role: deny'}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted">
        <Info size={13} weight="bold" className="mt-0.5 shrink-0" />
        Changes apply immediately and are enforced across the app, not just recorded here. Deny wins
        over any allow — including the member&rsquo;s role default.
      </p>
    </div>
  );
}
