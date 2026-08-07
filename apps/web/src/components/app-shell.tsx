'use client';

import {
  AddressBook,
  Archive,
  ArrowLeft,
  Bell,
  BookOpen,
  CaretRight,
  ClipboardText,
  ClockCounterClockwise,
  DotsThree,
  Gear,
  GraduationCap,
  List,
  MagnifyingGlass,
  Question,
  ShieldCheck,
  SidebarSimple,
  SignOut,
  SquaresFour,
  UserCircle,
  Users,
  Wallet,
  X,
} from '@phosphor-icons/react/dist/ssr';
import type { Action, ResourceKey } from '@toastly/access';
import { App, Avatar, Badge, Button, Drawer, Dropdown, Input, Layout, Menu } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useMemo } from 'react';

import { clearAuthStorage, readRefreshToken } from '@/lib/auth/token-storage';
import { useCan } from '@/lib/permissions/use-can';
import { toastlyApi, useAuthLogoutMutation } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectActiveContextKey,
  selectSessionUser,
  sessionUnauthenticated,
} from '@/store/session-slice';
import {
  mobileNavClosed,
  mobileNavOpened,
  selectBreadcrumb,
  selectMobileNavOpen,
  selectSidebarCollapsed,
  sidebarToggled,
  unitKeyForContext,
} from '@/store/ui-slice';

import toastieLogo from '../../assets/toastie.svg';
import { UnitSwitcher } from './unit-switcher';

/* Only Sider comes from antd — the header and content live inside the content
 * panel below, so antd's Header/Content wrappers would only fight the layout. */
const { Sider } = Layout;

const SIDER_WIDTH = 248;
const SIDER_COLLAPSED_WIDTH = 72;
/** Drawer width on phones. Wider than the sider — there is no content column
 * competing for the space, and thumbs want a bigger target. */
const MOBILE_NAV_WIDTH = 288;

/** Phosphor icons are plain components, so entries carry the type rather than
 * an element and the shell picks the size at the call site. */
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

interface NavEntry {
  /** Route the entry links to; doubles as the antd Menu key. */
  href: string;
  title: string;
  Icon: IconComponent;
  /** Right-aligned counter or tag, e.g. "17" or a status pill. */
  meta?: React.ReactNode;
  /** Gate this entry by the client-side `can()`. When absent the entry is
   * always shown — used for `/`, `/records` and `/me`, which have no
   * resource of their own. */
  access?: { resource: ResourceKey; action: Action };
}

/** Single source of truth for the sidebar — add a route here and the nav,
 * the selected state and the breadcrumb all pick it up. Entries with an
 * `access` clause disappear when `can()` returns false for the active
 * member, so a plain Member never sees Finance or Club Admin in the rail. */
const primaryNav: NavEntry[] = [
  { href: '/', title: 'Dashboard', Icon: SquaresFour },
  {
    href: '/meetings',
    title: 'Meetings',
    Icon: Users,
    access: { resource: 'meeting', action: 'read' },
  },
  {
    href: '/education',
    title: 'Education',
    Icon: GraduationCap,
    access: { resource: 'education', action: 'read' },
  },
  {
    href: '/library',
    title: 'Library',
    Icon: BookOpen,
    access: { resource: 'library', action: 'read' },
  },
  {
    href: '/people',
    title: 'People',
    Icon: AddressBook,
    access: { resource: 'member', action: 'read' },
  },
  {
    href: '/inventory',
    title: 'Inventory & checklist',
    Icon: ClipboardText,
    access: { resource: 'inventory', action: 'read' },
  },
  {
    href: '/finance',
    title: 'Finance',
    Icon: Wallet,
    access: { resource: 'transaction', action: 'read' },
  },
  { href: '/records', title: 'Records', Icon: Archive },
  {
    href: '/activity-logs',
    title: 'Activity Logs',
    Icon: ClockCounterClockwise,
    access: { resource: 'activityLog', action: 'read' },
  },
  {
    href: '/club-admin',
    title: 'Club Admin',
    Icon: Gear,
    access: { resource: 'memberRole', action: 'read' },
  },
  { href: '/me', title: 'Me', Icon: UserCircle },
];

const clubAdminNav: NavEntry[] = [
  {
    href: '/club-admin',
    title: 'Dashboard',
    Icon: SquaresFour,
    access: { resource: 'memberRole', action: 'read' },
  },
  {
    href: '/club-admin/members',
    title: 'Members',
    Icon: Users,
    access: { resource: 'memberRole', action: 'read' },
  },
  {
    href: '/club-admin/permissions',
    title: 'Permissions',
    Icon: ShieldCheck,
    access: { resource: 'memberPermission', action: 'read' },
  },
  {
    href: '/club-admin/audit-trail',
    title: 'Audit Trail',
    Icon: ClockCounterClockwise,
    access: { resource: 'activityLog', action: 'read' },
  },
];

/** Super Admin's two entries — the org-tree dashboard and the platform-wide
 * user directory. Drilling into a district/division/area still navigates by
 * breadcrumb and card drill-down, so only these two routes get a nav item. */
const superAdminNav: NavEntry[] = [
  { href: '/super-admin', title: 'Dashboard', Icon: SquaresFour },
  { href: '/super-admin/users', title: 'Users', Icon: Users },
];

/** Named routes win; anything deeper falls back to title-cased segments.
 * Crumbs are text-only — the icon lives on the sidebar entry instead. */
function buildTrail(pathname: string): { href: string; title: string }[] {
  const allNav = [...primaryNav, ...clubAdminNav, ...superAdminNav];
  const matched = allNav.find((entry) => entry.href === pathname);
  if (matched) return [{ href: matched.href, title: matched.title }];

  const segments = pathname.split('/').filter(Boolean);
  return segments.map((segment, index) => ({
    href: `/${segments.slice(0, index + 1).join('/')}`,
    title: segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
  }));
}

interface SideRowProps {
  Icon: IconComponent;
  label: string;
  trailing?: React.ReactNode;
  collapsed: boolean;
  onClick?: () => void;
}

/** The sidebar's secondary rows. These are actions rather than routes, so they
 * sit outside the Menu but borrow its metrics to stay on the same grid. */
function SideRow({ Icon, label, trailing, collapsed, onClick }: SideRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex h-9 w-full items-center rounded-lg text-sm text-ink-soft transition-colors hover:bg-fill hover:text-ink ${
        collapsed ? 'justify-center' : 'gap-2.5 px-2.5'
      }`}
    >
      <Icon size={18} />
      {collapsed ? null : (
        <>
          <span className="truncate">{label}</span>
          {trailing ? <span className="ml-auto flex items-center">{trailing}</span> : null}
        </>
      )}
    </button>
  );
}

interface SidebarBodyProps {
  /** Icon-only rail. Always false in the mobile drawer — there is nothing to
   * save space for once the nav is an overlay. */
  collapsed: boolean;
  pathname: string;
  notificationCount: number;
  account?: { name: string; avatarUrl?: string };
  /** Trailing control on the brand row: collapse on desktop, close on mobile. */
  brandAction: React.ReactNode;
  /** Fires when a nav entry is followed, so the drawer can dismiss itself. */
  onNavigate?: () => void;
  /** Which set of nav entries to render. Null means the nav list is blank —
   * the District/Division/Area drill-down scopes navigate by breadcrumb and
   * card drill-down and don't need a sidebar nav list. The
   * Help/Notifications/Account block below still renders regardless — a
   * blank nav list must never take the sign-out control down with it. */
  navEntries: NavEntry[] | null;
  /** Show the search bar above the nav. Only shown for the primary (club) nav. */
  showSearch?: boolean;
  onLogout: () => void;
}

/** The sidebar's contents, independent of what is holding them — the desktop
 * Sider and the mobile Drawer both render this so the nav can never drift. */
function SidebarBody({
  collapsed,
  pathname,
  notificationCount,
  account,
  brandAction,
  onNavigate,
  navEntries,
  showSearch = true,
  onLogout,
}: SidebarBodyProps) {
  return (
    /* pt-2 matches the content panel's inset so the brand row and the
     * breadcrumb sit on the same baseline. */
    <div className="flex h-full flex-col pt-2">
      {/* Brand row — matches the header height so both baselines line up. */}
      <div
        className={`flex h-15 shrink-0 items-center px-4 ${collapsed ? 'justify-center' : 'gap-2'}`}
      >
        {collapsed ? null : (
          <>
            {/* The mark carries its own colour, so it sits bare rather than in
             * a tinted chip. 32px keeps its optical weight on the row. */}
            <Image src={toastieLogo} alt="" aria-hidden className="h-8 w-auto shrink-0" priority />
            <span className="truncate text-base font-semibold text-ink">Toastie</span>
          </>
        )}
        <span className={collapsed ? '' : 'ml-auto'}>{brandAction}</span>
      </div>

      {navEntries ? (
        <>
          {showSearch ? (
            <div className="shrink-0 px-2 pb-2">
              {collapsed ? (
                <SideRow Icon={MagnifyingGlass} label="Search" collapsed />
              ) : (
                <Input
                  variant="filled"
                  placeholder="Search"
                  aria-label="Search"
                  prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
                />
              )}
            </div>
          ) : null}

          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            style={{ borderInlineEnd: 'none', background: 'transparent' }}
            items={navEntries.map((entry) => ({
              key: entry.href,
              icon: <entry.Icon size={18} />,
              label: (
                <Link
                  href={entry.href}
                  onClick={onNavigate}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{entry.title}</span>
                  {entry.meta ? <span className="text-xs text-ink-muted">{entry.meta}</span> : null}
                </Link>
              ),
            }))}
          />
        </>
      ) : null}

      {/* Pinned to the bottom of the sidebar regardless of whether a nav
       * list rendered above — a blank rail (org-tree scopes) must not take
       * the sign-out control down with it. */}
      <div className="mt-auto shrink-0 px-2 pb-3">
        <SideRow Icon={Question} label="Help center" collapsed={collapsed} />
        <SideRow
          Icon={Bell}
          label="Notifications"
          collapsed={collapsed}
          trailing={notificationCount > 0 ? <Badge count={notificationCount} size="small" /> : null}
        />
        {account ? (
          <Dropdown
            trigger={['click']}
            placement={collapsed ? 'topLeft' : 'top'}
            menu={{
              items: [
                {
                  key: 'logout',
                  label: 'Log out',
                  icon: <SignOut size={15} />,
                  onClick: onLogout,
                },
              ],
            }}
          >
            <button
              type="button"
              title={collapsed ? account.name : undefined}
              className={`mt-2 flex h-9 w-full items-center rounded-lg transition-colors hover:bg-fill ${
                collapsed ? 'justify-center' : 'gap-2.5 px-2.5'
              }`}
            >
              <Avatar size={22} src={account.avatarUrl}>
                {account.name.charAt(0).toUpperCase()}
              </Avatar>
              {collapsed ? null : <span className="truncate text-sm text-ink">{account.name}</span>}
            </button>
          </Dropdown>
        ) : null}
      </div>
    </div>
  );
}

interface AppShellProps {
  children?: React.ReactNode;
  /** Right-aligned header controls. Defaults to a settings/overflow pair. */
  actions?: React.ReactNode;
  /** Unread count on the notifications row; the badge is hidden at zero. */
  notificationCount?: number;
}

/** Unit-switcher scopes with real, routed dashboards — everything under these
 * prefixes renders regardless of `activeUnit`, so a bookmarked or
 * freshly-loaded URL still works before the switcher state catches up. */
const ORG_ROUTE_PREFIXES = ['/district', '/division', '/area', '/super-admin'];

function isOrgRoute(pathname: string): boolean {
  return ORG_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isClubAdminRoute(pathname: string): boolean {
  return pathname === '/club-admin' || pathname.startsWith('/club-admin/');
}

function isSuperAdminNavRoute(pathname: string): boolean {
  return pathname === '/super-admin' || pathname === '/super-admin/users';
}

export function AppShell({ children, actions, notificationCount = 0 }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  /* Held in the store rather than local state so the sidebar keeps its width
   * across route changes. */
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const mobileNavOpen = useAppSelector(selectMobileNavOpen);
  /* Derived from `contextKey`, not a separate piece of state. A Super
   * Admin in `global` context has `activeUnit === 'super-admin'` on first
   * paint (no more default-to-club stale flash). */
  const contextKey = useAppSelector(selectActiveContextKey);
  const activeUnit = unitKeyForContext(contextKey);
  const breadcrumbSlot = useAppSelector(selectBreadcrumb);
  const sessionUser = useAppSelector(selectSessionUser);
  const account = sessionUser
    ? { name: `${sessionUser.firstName} ${sessionUser.lastName}` }
    : undefined;
  const dispatch = useAppDispatch();
  const closeMobileNav = () => dispatch(mobileNavClosed());

  const { message } = App.useApp();
  const [authLogout] = useAuthLogoutMutation();
  /* Best-effort server-side revoke (kills this refresh token's family), then
   * unconditionally clear local state — a failed revoke call must never
   * leave the user stuck signed in on their own machine. */
  const handleLogout = async () => {
    const refreshToken = readRefreshToken();
    try {
      if (refreshToken) await authLogout({ refreshToken }).unwrap();
    } catch {
      // Ignore — the token may already be expired/revoked server-side.
    } finally {
      clearAuthStorage();
      dispatch(toastlyApi.util.resetApiState());
      dispatch(sessionUnauthenticated());
      message.success('Signed out');
      router.replace('/login');
    }
  };

  /* District/Division/Area drill-downs navigate by breadcrumb and card
   * drill-down — no sidebar nav needed. Club Admin has its own three-entry
   * nav, Super Admin its own Dashboard/Users pair, and the primary nav is
   * club-specific for everything else. A Super Admin in `global` context on
   * an org drill-down route gets `null` here (blank rail) rather than the
   * stale-default club nav they used to see on first paint. */
  const onOrgRoute = isOrgRoute(pathname);
  const onClubAdminRoute = isClubAdminRoute(pathname);
  const onSuperAdminNavRoute = isSuperAdminNavRoute(pathname);
  const rawNavEntries: NavEntry[] | null = onClubAdminRoute
    ? clubAdminNav
    : onSuperAdminNavRoute
      ? superAdminNav
      : activeUnit === 'club' && !onOrgRoute
        ? primaryNav
        : null;

  /* Drop entries the current member can't read. `useCan` returns `false`
   * while loading, so entries with an `access` clause stay hidden until the
   * subject arrives — better a single frame short than a flash of a link
   * that 403s on click. Entries without `access` (Dashboard, Records, Me)
   * are always visible. */
  const isPrimaryNav = rawNavEntries === primaryNav;
  const { can, isLoading: canLoading } = useCan();
  const navEntries = useMemo<NavEntry[] | null>(() => {
    if (!rawNavEntries) return null;
    if (canLoading) return rawNavEntries.filter((entry) => !entry.access);
    return rawNavEntries.filter((entry) =>
      entry.access ? can(entry.access.action, entry.access.resource) : true,
    );
  }, [rawNavEntries, can, canLoading]);

  const rawTrail = breadcrumbSlot.trail ?? buildTrail(pathname);
  const trail = breadcrumbSlot.trail
    ? rawTrail
    : breadcrumbSlot.label
      ? rawTrail.map((crumb, index) =>
          index === rawTrail.length - 1
            ? { ...crumb, title: breadcrumbSlot.label as string }
            : crumb,
        )
      : rawTrail;

  return (
    <Layout className="h-screen">
      {/* Below `md` the sider is dropped from the flow entirely and the nav
       * moves into the drawer below, so the content panel gets the full width. */}
      <Sider
        className="hidden md:block"
        collapsed={collapsed}
        collapsedWidth={SIDER_COLLAPSED_WIDTH}
        width={SIDER_WIDTH}
        trigger={null}
        theme="light"
      >
        <SidebarBody
          collapsed={collapsed}
          pathname={pathname}
          notificationCount={notificationCount}
          account={account}
          navEntries={navEntries}
          showSearch={isPrimaryNav}
          onLogout={handleLogout}
          brandAction={
            <Button
              type="text"
              size="small"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => dispatch(sidebarToggled())}
              icon={<SidebarSimple size={18} className="text-ink-muted" />}
            />
          }
        />
      </Sider>

      {/* `rootClassName` hides the overlay if the viewport crosses into desktop
       * while it is open — the sider takes over from there. */}
      <Drawer
        rootClassName="md:hidden"
        placement="left"
        open={mobileNavOpen}
        onClose={closeMobileNav}
        closable={false}
        size={MOBILE_NAV_WIDTH}
        styles={{ body: { padding: 0, background: 'var(--color-sidebar)' } }}
      >
        <SidebarBody
          collapsed={false}
          pathname={pathname}
          notificationCount={notificationCount}
          account={account}
          navEntries={navEntries}
          showSearch={isPrimaryNav}
          onNavigate={closeMobileNav}
          onLogout={handleLogout}
          brandAction={
            <Button
              type="text"
              size="small"
              aria-label="Close menu"
              onClick={closeMobileNav}
              icon={<X size={18} className="text-ink-muted" />}
            />
          }
        />
      </Drawer>

      {/* The sidebar bleeds into the page background; the only border in the
       * shell is the one wrapping this panel. */}
      {/* The `app-shell-*` classes are print hooks — globals.css unwraps both
       * when a page prints so only the printed content reaches the paper. */}
      <div className="app-shell-frame flex min-w-0 flex-1 flex-col p-2">
        <div className="app-shell-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
          <header className="flex h-15 shrink-0 items-center gap-1 border-b border-line px-3 md:px-4">
            {/* antd's `display` rule is unlayered and would beat Tailwind's
             * `hidden`, so the breakpoint lives on a wrapper, not the Button. */}
            <span className="md:hidden">
              <Button
                type="text"
                size="small"
                aria-label="Open menu"
                onClick={() => dispatch(mobileNavOpened())}
                icon={<List size={18} className="text-ink-soft" />}
              />
            </span>
            <Button
              type="text"
              size="small"
              aria-label="Go back"
              onClick={() => router.back()}
              icon={<ArrowLeft size={18} className="text-ink-soft" />}
            />
            <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-line-strong" />

            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
              {trail.map((crumb, index) => {
                const isLast = index === trail.length - 1;
                return (
                  <Fragment key={crumb.href}>
                    {index > 0 ? (
                      <CaretRight size={12} className="shrink-0 text-ink-muted" />
                    ) : null}
                    <Link
                      href={crumb.href}
                      aria-current={isLast ? 'page' : undefined}
                      className={`flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-fill ${
                        isLast ? 'font-medium text-ink' : 'text-ink-soft'
                      }`}
                    >
                      <span className="truncate">{crumb.title}</span>
                    </Link>
                  </Fragment>
                );
              })}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <UnitSwitcher />
              <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-line-strong" />
              {actions ?? (
                <>
                  <Button
                    type="text"
                    size="small"
                    aria-label="Settings"
                    icon={<Gear size={18} className="text-ink-soft" />}
                  />
                  <Button
                    type="text"
                    size="small"
                    aria-label="More options"
                    icon={<DotsThree size={18} className="text-ink-soft" />}
                  />
                </>
              )}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </Layout>
  );
}
