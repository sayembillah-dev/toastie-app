'use client';

import {
  MagnifyingGlass,
  ShieldCheck,
  UserPlus,
  Users,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Dropdown, Input, Segmented, Skeleton, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { ConvertGuestModal } from '@/components/club-admin/convert-guest-modal';
import { InvitePanel } from '@/components/club-admin/invite-panel';
import { MemberFormModal } from '@/components/club-admin/member-form-modal';
import { StaggerItem, StaggerList } from '@/components/motion/stagger-list';
import { ReadOnly } from '@/components/permissions/read-only';
import { PersonAvatar } from '@/components/ui/person-avatar';
import type { Member } from '@/lib/education/members';
import { formatRoles, getInitials } from '@/lib/education/members';
import { useCan } from '@/lib/permissions/use-can';
import {
  useGetMembersQuery,
  useSetMemberAdminMutation,
  useSetMemberStatusMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

type RosterFilter = 'active' | 'removed';

function matchesQuery(member: Member, needle: string): boolean {
  return `${member.firstName} ${member.lastName} ${formatRoles(member)}`
    .toLowerCase()
    .includes(needle);
}

/** The roster — every member the club has, active or removed, plus
 * whoever's mid-invite. Add/edit/remove/restore, role and Club Admin
 * changes all live here; per-module permission editing is its own tab. */
export function MembersTab() {
  const { message } = App.useApp();
  const { can } = useCan();
  const canMutate = can('update', 'memberRole');
  const {
    data: members,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetMembersQuery({ includeRemoved: true });

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RosterFilter>('active');
  const [convertOpen, setConvertOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [setStatus] = useSetMemberStatusMutation();
  const [setAdmin] = useSetMemberAdminMutation();

  const filtered = useMemo(() => {
    if (!members) return [];
    const needle = query.trim().toLowerCase();
    return members
      .filter((member) => member.status === filter)
      .filter((member) => (needle ? matchesQuery(member, needle) : true))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [members, query, filter]);

  async function handleStatusChange(member: Member, status: Member['status']) {
    try {
      await setStatus({ memberId: member.id, status }).unwrap();
      message.success(
        status === 'removed' ? `Removed ${member.firstName}` : `Restored ${member.firstName}`,
      );
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this member'));
    }
  }

  async function handleAdminToggle(member: Member) {
    try {
      await setAdmin({ memberId: member.id, isClubAdmin: !member.isClubAdmin }).unwrap();
      message.success(
        member.isClubAdmin
          ? `${member.firstName} is no longer a Club Admin`
          : `${member.firstName} is now a Club Admin`,
      );
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update Club Admin rights'));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56">
              <Input
                allowClear
                placeholder="Search members"
                aria-label="Search members"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
              />
            </div>
            <Segmented
              value={filter}
              onChange={(value) => setFilter(value as RosterFilter)}
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Removed', value: 'removed' },
              ]}
            />
          </div>
          <ReadOnly resource="member" action="create">
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={<UserPlus size={14} />} onClick={() => setConvertOpen(true)}>
                Add from guests
              </Button>
            </div>
          </ReadOnly>
        </div>

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
            <Button className="mt-4" size="small" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : null}

        {isLoading && !isError ? (
          <div className="rounded-xl border border-line bg-canvas p-4">
            <Skeleton active title={false} paragraph={{ rows: 6 }} />
          </div>
        ) : null}

        {!isLoading && !isError && filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
            <span
              aria-hidden
              className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
            >
              <Users size={18} weight="bold" />
            </span>
            <p className="text-sm text-ink-soft">
              {filter === 'removed' ? 'No removed members.' : 'No members match this filter.'}
            </p>
          </div>
        ) : null}

        {/* `wrap={false}` — the rows already are the list items, so they
            animate themselves instead of being wrapped in a second `<li>`. */}
        {!isLoading && !isError && filtered.length > 0 ? (
          <StaggerList className="flex flex-col gap-2" wrap={false}>
            {filtered.map((member) => (
              <StaggerItem
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <PersonAvatar src={member.avatarUrl} initials={getInitials(member)} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                      {member.firstName} {member.lastName}
                      {member.isClubAdmin ? (
                        <Tag color="gold" className="inline-flex items-center gap-1">
                          <ShieldCheck size={11} weight="bold" /> Admin
                        </Tag>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-ink-muted">{formatRoles(member)}</p>
                  </div>
                </div>
                <ReadOnly resource="memberRole">
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        { key: 'edit', label: 'Edit member' },
                        {
                          key: 'admin',
                          label: member.isClubAdmin ? 'Remove as Club Admin' : 'Make Club Admin',
                        },
                        member.status === 'active'
                          ? { key: 'remove', label: 'Remove member', danger: true }
                          : { key: 'restore', label: 'Restore member' },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'edit') setEditingMember(member);
                        else if (key === 'admin') void handleAdminToggle(member);
                        else if (key === 'remove') void handleStatusChange(member, 'removed');
                        else if (key === 'restore') void handleStatusChange(member, 'active');
                      },
                    }}
                  >
                    <Button size="small">Actions</Button>
                  </Dropdown>
                </ReadOnly>
              </StaggerItem>
            ))}
          </StaggerList>
        ) : null}
      </div>

      <InvitePanel />

      <MemberFormModal
        open={editingMember !== null}
        member={editingMember}
        onClose={() => setEditingMember(null)}
      />
      <ConvertGuestModal open={convertOpen} onClose={() => setConvertOpen(false)} />
    </div>
  );
}
