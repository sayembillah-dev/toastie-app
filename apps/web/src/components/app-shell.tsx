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
  SidebarSimple,
  SquaresFour,
  UserCircle,
  Users,
  Wallet,
  X,
} from '@phosphor-icons/react/dist/ssr';
import { Avatar, Badge, Button, Drawer, Input, Layout, Menu } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment } from 'react';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  mobileNavClosed,
  mobileNavOpened,
  selectActiveUnit,
  selectMobileNavOpen,
  selectSidebarCollapsed,
  sidebarToggled,
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
}

/** Single source of truth for the sidebar — add a route here and the nav,
 * the selected state and the breadcrumb all pick it up. */
const primaryNav: NavEntry[] = [
  { href: '/', title: 'Dashboard', Icon: SquaresFour },
  { href: '/meetings', title: 'Meetings', Icon: Users },
  { href: '/education', title: 'Education', Icon: GraduationCap },
  { href: '/library', title: 'Library', Icon: BookOpen },
  { href: '/people', title: 'People', Icon: AddressBook },
  { href: '/inventory', title: 'Inventory & checklist', Icon: ClipboardText },
  { href: '/finance', title: 'Finance', Icon: Wallet },
  { href: '/records', title: 'Records', Icon: Archive },
  { href: '/activity-logs', title: 'Activity Logs', Icon: ClockCounterClockwise },
  { href: '/me', title: 'Me', Icon: UserCircle },
];

/** Named routes win; anything deeper falls back to title-cased segments.
 * Crumbs are text-only — the icon lives on the sidebar entry instead. */
function buildTrail(pathname: string): { href: string; title: string }[] {
  const matched = primaryNav.find((entry) => entry.href === pathname);
  if (matched) return [{ href: matched.href, title: matched.title }];

  const segments = pathname.split('/').filter(Boolean);
  return segments.map((segment, index) => ({
    href: `/${segments.slice(0, index + 1).join('/')}`,
    title: segment.replace(/-/g, ' ').replace(/^./, (char) => char.toUpperCase()),
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
  /** When false, the nav column is deliberately blank — `primaryNav` is
   * club-specific, and the org-tree scopes (Area, Division, District, Super
   * Admin) navigate by breadcrumb and card drill-down instead. Also blank for
   * `club-admin`, whose surfaces don't exist yet. */
  showNav: boolean;
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
  showNav,
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

      {showNav ? (
        <>
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

          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            style={{ borderInlineEnd: 'none', background: 'transparent' }}
            items={primaryNav.map((entry) => ({
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

          {/* Everything past this point is pinned to the bottom of the sidebar. */}
          <div className="mt-auto shrink-0 px-2 pb-3">
            <SideRow Icon={Question} label="Help center" collapsed={collapsed} />
            <SideRow
              Icon={Bell}
              label="Notifications"
              collapsed={collapsed}
              trailing={
                notificationCount > 0 ? <Badge count={notificationCount} size="small" /> : null
              }
            />
            {account ? (
              <div
                className={`mt-2 flex h-9 items-center rounded-lg ${
                  collapsed ? 'justify-center' : 'gap-2.5 px-2.5'
                }`}
              >
                <Avatar size={22} src={account.avatarUrl}>
                  {account.name.charAt(0).toUpperCase()}
                </Avatar>
                {collapsed ? null : (
                  <span className="truncate text-sm text-ink">{account.name}</span>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Placeholder for scopes whose surfaces do not exist yet. Centred vertically
 * and horizontally in the main area so it reads as a deliberate empty state
 * rather than a broken page. */
function ComingSoonPanel() {
  return (
    <div className="flex h-full min-h-[24rem] items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          In progress
        </span>
        <h2 className="text-lg font-semibold text-ink">Coming soon</h2>
        <p className="max-w-sm text-sm text-ink-soft">
          This scope is still being built. Switch back to Club from the header to keep working.
        </p>
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
  /** Signed-in account, rendered at the foot of the sidebar when present. */
  account?: { name: string; avatarUrl?: string };
  /** Overrides the label on the last breadcrumb crumb. Useful when the URL
   * carries an id (e.g. `/education/m-01`) and the human title lives in data. */
  breadcrumbLabel?: string;
  /** Replaces the computed trail outright. For routes with more than one
   * dynamic segment (e.g. `/district/[divisionId]/[areaId]`) the fallback
   * slug-title logic in `buildTrail` can't know the human names — the screen
   * fetches them and supplies the exact trail instead. */
  breadcrumbTrail?: { href: string; title: string }[];
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

export function AppShell({
  children,
  actions,
  notificationCount = 0,
  account,
  breadcrumbLabel,
  breadcrumbTrail,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  /* Held in the store rather than local state so the sidebar keeps its width
   * across route changes — every page mounts its own AppShell. */
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const mobileNavOpen = useAppSelector(selectMobileNavOpen);
  const activeUnit = useAppSelector(selectActiveUnit);
  const dispatch = useAppDispatch();
  const closeMobileNav = () => dispatch(mobileNavClosed());

  /* `club` and the org-tree scopes (district/division/area/super-admin) have
   * real surfaces; `club-admin` is still a placeholder. Content gating reads
   * the pathname rather than `activeUnit` alone so a bookmarked or
   * freshly-loaded org URL renders correctly before the switcher state (which
   * is not persisted) catches up. */
  const onOrgRoute = isOrgRoute(pathname);
  const showContent = activeUnit === 'club' || onOrgRoute;
  /* The primary nav is club-specific (Meetings, Finance, …); the org
   * dashboards navigate by breadcrumb and card drill-down instead, so their
   * sidebar stays blank the same way the placeholder scopes' did. */
  const showNav = activeUnit === 'club' && !onOrgRoute;

  const rawTrail = breadcrumbTrail ?? buildTrail(pathname);
  const trail = breadcrumbTrail
    ? rawTrail
    : breadcrumbLabel
      ? rawTrail.map((crumb, index) =>
          index === rawTrail.length - 1 ? { ...crumb, title: breadcrumbLabel } : crumb,
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
          showNav={showNav}
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
          showNav={showNav}
          onNavigate={closeMobileNav}
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

          <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            {showContent ? children : <ComingSoonPanel />}
          </main>
        </div>
      </div>
    </Layout>
  );
}
