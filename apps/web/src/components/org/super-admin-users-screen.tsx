'use client';

import {
  Crown,
  MagnifyingGlass,
  ShieldCheck,
  Trash,
  UserPlus,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Checkbox, Dropdown, Input, Pagination, Skeleton, Tag } from 'antd';
import { useMemo, useState } from 'react';

import { PageBreadcrumb } from '@/components/page-breadcrumb';
import {
  PLATFORM_USERS_PAGE_SIZE_OPTIONS,
  type PlatformUser,
  useBulkDeletePlatformUsersMutation,
  useListPlatformUsersQuery,
  useSetPlatformUserAdminMutation,
  useSetPlatformUserStatusMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppSelector } from '@/store/hooks';
import { selectSessionUser } from '@/store/session-slice';

import { CreateUserModal } from './create-user-modal';
import { UserDetailDrawer } from './user-detail-drawer';

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
  const [pageSize, setPageSize] = useState<number>(PLATFORM_USERS_PAGE_SIZE_OPTIONS[1]);
  const trimmedSearch = search.trim();
  const args = useMemo(
    () => ({ search: trimmedSearch || undefined, page, pageSize }),
    [trimmedSearch, page, pageSize],
  );
  const { data, isFetching, isError, error, refetch } = useListPlatformUsersQuery(args);
  const [setStatus, statusMut] = useSetPlatformUserStatusMutation();
  const [setAdmin, adminMut] = useSetPlatformUserAdminMutation();
  const [bulkDelete, bulkDeleteMut] = useBulkDeletePlatformUsersMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<PlatformUser | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Selection is page-scoped. Rather than an effect, this follows React's
  // "adjust state during render" pattern: when `page`/`pageSize`/
  // `trimmedSearch` move past what the selection was captured for, clear it
  // before this render commits so a stale id from a page the caller has
  // left never lingers.
  const [selectionScope, setSelectionScope] = useState({ page, pageSize, trimmedSearch });
  if (
    selectionScope.page !== page ||
    selectionScope.pageSize !== pageSize ||
    selectionScope.trimmedSearch !== trimmedSearch
  ) {
    setSelectionScope({ page, pageSize, trimmedSearch });
    setSelectedIds(new Set());
  }

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  // A row can't delete its own account — mirrors the disabled self-suspend
  // action below, and keeps `CANNOT_DELETE_SELF` from ever being reachable
  // through this UI rather than only defending against it server-side.
  const selectableRows = rows.filter((user) => user.id !== sessionUser?.id);
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((user) => selectedIds.has(user.id));
  const someSelected = selectableRows.some((user) => selectedIds.has(user.id));

  function handleSearchChange(value: string) {
    setSearch(value);
    // A search change resets pagination so the caller doesn't scroll
    // through an empty page 4 of a 1-page result.
    setPage(1);
  }

  function toggleSelected(userId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(selectableRows.map((user) => user.id)) : new Set());
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      modal.confirm({
        title: `Delete ${ids.length} account${ids.length === 1 ? '' : 's'} forever?`,
        content:
          'This permanently deletes the selected accounts — sign-in, admin rights and platform history all go with them. It cannot be undone. Club rosters are unaffected.',
        okText: 'Delete forever',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;
    try {
      const result = await bulkDelete(ids).unwrap();
      message.success(
        `Deleted ${result.deletedCount} account${result.deletedCount === 1 ? '' : 's'}`,
      );
      setSelectedIds(new Set());
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the selected accounts'));
    }
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
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            disabled={selectableRows.length === 0}
            onChange={(event) => toggleSelectAll(event.target.checked)}
            aria-label="Select all accounts on this page"
          />
          <Input
            prefix={<MagnifyingGlass size={14} className="text-ink-muted" />}
            placeholder="Search phone, email, or name"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            allowClear
            className="max-w-md"
          />
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink">{selectedIds.size} selected</span>
              <Button
                danger
                size="small"
                icon={<Trash size={13} weight="bold" />}
                loading={bulkDeleteMut.isLoading}
                onClick={() => void handleBulkDelete()}
              >
                Delete forever
              </Button>
            </div>
          ) : (
            <span className="text-xs text-ink-muted">
              {isFetching ? 'Loading…' : `${total.toLocaleString()} accounts`}
            </span>
          )}
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
                const busy = statusMut.isLoading || adminMut.isLoading || bulkDeleteMut.isLoading;
                return (
                  <li key={user.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Checkbox
                        checked={selectedIds.has(user.id)}
                        disabled={isSelf}
                        title={isSelf ? "You can't delete your own account" : undefined}
                        onChange={(event) => toggleSelected(user.id, event.target.checked)}
                        aria-label={`Select ${user.firstName} ${user.lastName}`}
                      />
                      {/* The row's own click target — a real button (not a
                       * `<li onClick>`) so it's keyboard-reachable for free
                       * and doesn't need to fight the checkbox/dropdown for
                       * the click, matching `pathways-tab.tsx`'s card-open
                       * pattern. */}
                      <button
                        type="button"
                        onClick={() => setDetailUser(user)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 pr-2 text-left transition-colors hover:bg-fill/60"
                      >
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
                      </button>
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

        {data ? (
          <div className="flex justify-end">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              pageSizeOptions={PLATFORM_USERS_PAGE_SIZE_OPTIONS.map(String)}
              onChange={(next, size) => {
                if (size !== pageSize) {
                  // A page-size change resets to page 1 — the caller's
                  // previous `next` was computed against the old size and
                  // no longer means the same slice of results.
                  setPageSize(size);
                  setPage(1);
                } else {
                  setPage(next);
                }
              }}
            />
          </div>
        ) : null}
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <UserDetailDrawer
        user={detailUser}
        open={detailUser !== null}
        onClose={() => setDetailUser(null)}
      />
    </>
  );
}

export function getInitials(user: PlatformUser): string {
  const f = user.firstName?.charAt(0) ?? '';
  const l = user.lastName?.charAt(0) ?? '';
  return `${f}${l}`.toUpperCase() || '?';
}
