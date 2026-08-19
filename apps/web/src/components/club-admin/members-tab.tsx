'use client';

import {
  CaretDown,
  Clock,
  MagnifyingGlass,
  PaperPlaneTilt,
  ShieldCheck,
  Table as TableIcon,
  UserPlus,
  Users,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Dropdown, Input, Segmented, Skeleton, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { BulkAddMembersModal } from '@/components/club-admin/bulk-add-members-modal';
import { ConvertGuestModal } from '@/components/club-admin/convert-guest-modal';
import { InvitePanel } from '@/components/club-admin/invite-panel';
import { MemberFormModal } from '@/components/club-admin/member-form-modal';
import { MemberInviteModal } from '@/components/club-admin/member-invite-modal';
import { StaggerItem, StaggerList } from '@/components/motion/stagger-list';
import { ReadOnly } from '@/components/permissions/read-only';
import { PersonAvatar } from '@/components/ui/person-avatar';
import type { Member } from '@/lib/education/members';
import { formatRoles, getInitials } from '@/lib/education/members';
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
  const {
    data: members,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetMembersQuery({ includeRemoved: true });

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RosterFilter>('active');
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [invitingMember, setInvitingMember] = useState<Member | null>(null);

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
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    { key: 'single', label: 'Single member', icon: <UserPlus size={14} /> },
                    { key: 'bulk', label: 'Bulk members', icon: <TableIcon size={14} /> },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'single') setAddOpen(true);
                    else if (key === 'bulk') setBulkOpen(true);
                  },
                }}
              >
                <Button type="primary" icon={<UserPlus size={14} />}>
                  Add member <CaretDown size={12} />
                </Button>
              </Dropdown>
              <Button icon={<Users size={14} />} onClick={() => setConvertOpen(true)}>
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
                      {/* No account has claimed this roster row yet — the
                          person can still be assigned everywhere, and the row
                          links itself the moment they sign up (with a matching
                          phone, if one is set). */}
                      {!member.userId ? (
                        <Tag className="inline-flex items-center gap-1">
                          <Clock size={11} weight="bold" /> Not joined yet
                        </Tag>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {formatRoles(member)}
                      {member.phone ? ` · ${member.phone}` : null}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Personal invite link — only meaningful while the roster
                      row is unclaimed; once they hold an account the row is
                      theirs already. */}
                  {!member.userId && member.status === 'active' ? (
                    <ReadOnly resource="invite" action="create">
                      <Button
                        size="small"
                        icon={<PaperPlaneTilt size={13} />}
                        onClick={() => setInvitingMember(member)}
                      >
                        Invite
                      </Button>
                    </ReadOnly>
                  ) : null}
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
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        ) : null}
      </div>

      <InvitePanel />

      <MemberFormModal open={addOpen} member={null} onClose={() => setAddOpen(false)} />
      <BulkAddMembersModal open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <MemberFormModal
        open={editingMember !== null}
        member={editingMember}
        onClose={() => setEditingMember(null)}
      />
      <MemberInviteModal member={invitingMember} onClose={() => setInvitingMember(null)} />
      <ConvertGuestModal open={convertOpen} onClose={() => setConvertOpen(false)} />
    </div>
  );
}
