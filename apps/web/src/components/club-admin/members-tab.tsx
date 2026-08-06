'use client';

import {
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Dropdown, Input, Segmented, Skeleton, Tag } from 'antd';
import { useMemo, useState } from 'react';

import { ConvertGuestModal } from '@/components/club-admin/convert-guest-modal';
import { InviteModal } from '@/components/club-admin/invite-modal';
import { MemberFormModal } from '@/components/club-admin/member-form-modal';
import type { Member } from '@/lib/education/members';
import { formatRoles, getInitials } from '@/lib/education/members';
import { usePermission } from '@/lib/permissions/use-permission';
import {
  useConvertInviteToMemberMutation,
  useGetInvitesQuery,
  useGetMembersQuery,
  useRevokeInviteMutation,
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
  const { mutate: canMutate } = usePermission('clubAdmin');
  const {
    data: members,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetMembersQuery({ includeRemoved: true });
  const { data: invites } = useGetInvitesQuery();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RosterFilter>('active');
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [setStatus] = useSetMemberStatusMutation();
  const [setAdmin] = useSetMemberAdminMutation();
  const [revokeInvite] = useRevokeInviteMutation();
  const [convertInvite] = useConvertInviteToMemberMutation();

  const filtered = useMemo(() => {
    if (!members) return [];
    const needle = query.trim().toLowerCase();
    return members
      .filter((member) => member.status === filter)
      .filter((member) => (needle ? matchesQuery(member, needle) : true))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [members, query, filter]);

  const pendingInvites = useMemo(
    () => (invites ?? []).filter((invite) => invite.status === 'pending'),
    [invites],
  );

  function closeMemberForm() {
    setAddOpen(false);
    setEditingMember(null);
  }

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

  async function handleRevokeInvite(inviteId: string, email: string) {
    try {
      await revokeInvite(inviteId).unwrap();
      message.success(`Revoked the invite to ${email}`);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not revoke this invite'));
    }
  }

  async function handleConvertInvite(inviteId: string) {
    try {
      const member = await convertInvite(inviteId).unwrap();
      message.success(`${member.firstName} ${member.lastName} joined as a member`);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not convert this invite'));
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
          {canMutate ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={<UserPlus size={14} />} onClick={() => setConvertOpen(true)}>
                Add from guests
              </Button>
              <Button icon={<Plus size={14} />} onClick={() => setInviteOpen(true)}>
                Invite member
              </Button>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
                Add member
              </Button>
            </div>
          ) : null}
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

        {!isLoading && !isError && filtered.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {filtered.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-semibold text-ink-soft"
                  >
                    {getInitials(member)}
                  </span>
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
                {canMutate ? (
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
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {canMutate && pendingInvites.length > 0 ? (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Pending invites
          </h2>
          <ul className="flex flex-col gap-2">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {invite.firstName || invite.lastName
                      ? `${invite.firstName ?? ''} ${invite.lastName ?? ''}`.trim()
                      : invite.email}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {invite.email}
                    {invite.roles.length > 0 ? ` · ${invite.roles.join(', ')}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="small" onClick={() => void handleConvertInvite(invite.id)}>
                    Mark as joined
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => void handleRevokeInvite(invite.id, invite.email)}
                  >
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <MemberFormModal
        open={addOpen || editingMember !== null}
        member={editingMember}
        onClose={closeMemberForm}
      />
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ConvertGuestModal open={convertOpen} onClose={() => setConvertOpen(false)} />
    </div>
  );
}
