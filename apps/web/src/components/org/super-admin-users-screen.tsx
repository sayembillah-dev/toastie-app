'use client';

import { Crown, MagnifyingGlass, ShieldCheck, UserPlus } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Dropdown, Input, Pagination, Skeleton, Tag } from 'antd';
import { useMemo, useState } from 'react';

import { PageBreadcrumb } from '@/components/page-breadcrumb';
import {
  type PlatformUser,
  useListPlatformUsersQuery,
  useSetPlatformUserAdminMutation,
  useSetPlatformUserStatusMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppSelector } from '@/store/hooks';
import { selectSessionUser } from '@/store/session-slice';

import { CreateUserModal } from './create-user-modal';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Super Admin platform-wide User directory. Sees every account across
 * every club, can suspend / reactivate, and can promote / demote other
 * Super Admins. The API refuses self-suspend and refuses to demote the
 * last remaining Super Admin — the UI mirrors both as disabled actions
 * with a tooltip. */
export function SuperAdminUsersScreen() {
  const { message, modal } = App.useApp();
  const sessionUser = useAppSelector(selectSessionUser);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const trimmedSearch = search.trim();
  const args = useMemo(() => ({ search: trimmedSearch || undefined, page }), [trimmedSearch, page]);
  const { data, isFetching, isError, error, refetch } = useListPlatformUsersQuery(args);
  const [setStatus, statusMut] = useSetPlatformUserStatusMutation();
  const [setAdmin, adminMut] = useSetPlatformUserAdminMutation();
  const [createOpen, setCreateOpen] = useState(false);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  function handleSearchChange(value: string) {
    setSearch(value);
    // A search change resets pagination so the caller doesn't scroll
    // through an empty page 4 of a 1-page result.
    setPage(1);
  }

  async function toggleStatus(user: PlatformUser) {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await setStatus({ userId: user.id, status: nextStatus }).unwrap();
      message.success(
        nextStatus === 'suspended'
          ? `${user.firstName} ${user.lastName} suspended`
          : `${user.firstName} ${user.lastName} reactivated`,
      );
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this account'));
    }
  }

  async function toggleAdmin(user: PlatformUser) {
    const nextAdmin = !user.isSuperAdmin;
    const confirmed = await new Promise<boolean>((resolve) => {
      modal.confirm({
        title: nextAdmin ? 'Promote to Super Admin?' : 'Remove Super Admin?',
        content: nextAdmin
          ? `${user.firstName} ${user.lastName} will gain full access to every club and the org tree.`
          : `${user.firstName} ${user.lastName} will lose global access.`,
        okText: nextAdmin ? 'Promote' : 'Remove',
        cancelText: 'Cancel',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;
    try {
      await setAdmin({ userId: user.id, isSuperAdmin: nextAdmin }).unwrap();
      message.success(nextAdmin ? 'Promoted to Super Admin' : 'Removed Super Admin rights');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update Super Admin status'));
    }
  }

  return (
    <>
      <PageBreadcrumb
        trail={[
          { href: '/super-admin', title: 'Super Admin' },
          { href: '/super-admin/users', title: 'Users' },
        ]}
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-ink">Users</h1>
            <p className="text-sm text-ink-soft">
              Every account across the platform. Suspend or promote from here — role and membership
              changes still live on each club&rsquo;s roster.
            </p>
          </div>
          <Button
            type="primary"
            icon={<UserPlus size={15} weight="bold" />}
            onClick={() => setCreateOpen(true)}
          >
            Add user
          </Button>
        </header>

        <div className="flex items-center gap-2">
          <Input
            prefix={<MagnifyingGlass size={14} className="text-ink-muted" />}
            placeholder="Search phone, email, or name"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            allowClear
            className="max-w-md"
          />
          <span className="text-xs text-ink-muted">
            {isFetching ? 'Loading…' : `${total.toLocaleString()} accounts`}
          </span>
        </div>

        <div className="rounded-xl border border-line bg-canvas">
          {isError ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <p className="text-sm text-ink">Could not load users</p>
              <p className="text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
              <Button size="small" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : isFetching && rows.length === 0 ? (
            <div className="px-4 py-4">
              <Skeleton active title={false} paragraph={{ rows: 6 }} />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
              <p className="text-sm text-ink">No matches</p>
              <p className="text-xs text-ink-muted">
                {trimmedSearch ? `No account matches "${trimmedSearch}"` : 'No accounts exist yet'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((user) => {
                const isSelf = sessionUser?.id === user.id;
                const busy = statusMut.isLoading || adminMut.isLoading;
                return (
                  <li key={user.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-semibold text-ink-soft"
                      >
                        {getInitials(user)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-ink">
                            {user.firstName} {user.lastName}
                          </p>
                          {user.isSuperAdmin ? (
                            <Tag color="gold" icon={<Crown size={11} weight="fill" />}>
                              Super Admin
                            </Tag>
                          ) : null}
                          {user.status === 'suspended' ? (
                            <Tag color="default">Suspended</Tag>
                          ) : null}
                          {isSelf ? <Tag color="blue">You</Tag> : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {user.phone}
                          {user.email ? ` · ${user.email}` : ''}
                          {' · '}
                          {user.membershipCount} membership
                          {user.membershipCount === 1 ? '' : 's'}
                          {user.orgAssignmentCount > 0
                            ? ` · ${user.orgAssignmentCount} director role${user.orgAssignmentCount === 1 ? '' : 's'}`
                            : ''}
                          {' · joined '}
                          {DATE_FMT.format(new Date(user.createdAt))}
                        </p>
                      </div>
                    </div>

                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          {
                            key: 'toggle-admin',
                            label: user.isSuperAdmin ? 'Remove Super Admin' : 'Make Super Admin',
                            icon: <ShieldCheck size={14} />,
                            disabled: busy || isSelf,
                            onClick: () => void toggleAdmin(user),
                          },
                          { type: 'divider' as const },
                          {
                            key: 'toggle-status',
                            label:
                              user.status === 'active' ? 'Suspend account' : 'Reactivate account',
                            danger: user.status === 'active',
                            disabled: busy || (isSelf && user.status === 'active'),
                            onClick: () => void toggleStatus(user),
                          },
                        ],
                      }}
                    >
                      <Button size="small">Manage</Button>
                    </Dropdown>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {data && total > rows.length + (page - 1) * rows.length ? (
          <div className="flex justify-end">
            <Pagination
              current={page}
              pageSize={25}
              total={total}
              showSizeChanger={false}
              onChange={(next) => setPage(next)}
            />
          </div>
        ) : null}
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function getInitials(user: PlatformUser): string {
  const f = user.firstName?.charAt(0) ?? '';
  const l = user.lastName?.charAt(0) ?? '';
  return `${f}${l}`.toUpperCase() || '?';
}
