'use client';

import { Info, MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import { App, Select, Skeleton, Switch } from 'antd';
import { useMemo, useState } from 'react';

import { formatRoles, getInitials } from '@/lib/education/members';
import {
  getEffectivePermission,
  getModuleLabel,
  MODULES,
  type ModuleKey,
} from '@/lib/permissions/permissions';
import { useGetMembersQuery, useSetMemberPermissionsMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/** Per-member, per-module read/mutate matrix. Club Admins bypass this
 * entirely (`getEffectivePermission` always gives them full access), so the
 * matrix is disabled rather than pretending an override would matter — the
 * enforcement chokepoint in `local-db/handlers.ts` agrees. */
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

  async function handleToggle(module: ModuleKey, field: 'read' | 'mutate', checked: boolean) {
    if (!selected) return;
    const current = getEffectivePermission(selected, module);
    const next = { ...current, [field]: checked };
    /* Read can't be off while mutate is on — mirrors the chokepoint's own
     * GET/mutate split, where mutate access without read access is
     * meaningless. */
    if (field === 'read' && !checked) next.mutate = false;
    if (field === 'mutate' && checked) next.read = true;

    try {
      await setPermissions({ memberId: selected.id, permissions: { [module]: next } }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this permission'));
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl rounded-xl border border-line bg-canvas p-4">
        <Skeleton active title={false} paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
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
                Club Admins have full read and mutate access to every module. Remove their Club
                Admin rights from the Members tab to set individual permissions instead.
              </span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2 font-medium">Module</th>
                  <th className="px-3 py-2 font-medium">Read</th>
                  <th className="px-3 py-2 font-medium">Mutate</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.map((module) => {
                  const permission = getEffectivePermission(selected, module);
                  return (
                    <tr key={module} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-2.5 text-ink">{getModuleLabel(module)}</td>
                      <td className="px-3 py-2.5">
                        <Switch
                          size="small"
                          checked={permission.read}
                          loading={isSaving}
                          onChange={(checked) => void handleToggle(module, 'read', checked)}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Switch
                          size="small"
                          checked={permission.mutate}
                          loading={isSaving}
                          onChange={(checked) => void handleToggle(module, 'mutate', checked)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted">
        <Info size={13} weight="bold" className="mt-0.5 shrink-0" />
        Changes apply immediately and are enforced across the app, not just recorded here.
      </p>
    </div>
  );
}
