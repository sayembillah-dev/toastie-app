'use client';

import {
  ArrowLeft,
  Bell,
  Bread,
  CaretRight,
  DotsThree,
  Gear,
  GraduationCap,
  MagnifyingGlass,
  Question,
  SidebarSimple,
  SquaresFour,
  Users,
} from '@phosphor-icons/react/dist/ssr';
import { Avatar, Badge, Button, Input, Layout, Menu } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';

/* Only Sider comes from antd — the header and content live inside the content
 * panel below, so antd's Header/Content wrappers would only fight the layout. */
const { Sider } = Layout;

const SIDER_WIDTH = 248;
const SIDER_COLLAPSED_WIDTH = 72;

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
}

export function AppShell({
  children,
  actions,
  notificationCount = 0,
  account,
  breadcrumbLabel,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const rawTrail = buildTrail(pathname);
  const trail = breadcrumbLabel
    ? rawTrail.map((crumb, index) =>
        index === rawTrail.length - 1 ? { ...crumb, title: breadcrumbLabel } : crumb,
      )
    : rawTrail;

  return (
    <Layout className="h-screen">
      <Sider
        collapsed={collapsed}
        collapsedWidth={SIDER_COLLAPSED_WIDTH}
        width={SIDER_WIDTH}
        trigger={null}
        theme="light"
      >
        {/* pt-2 matches the content panel's inset so the brand row and the
         * breadcrumb sit on the same baseline. */}
        <div className="flex h-full flex-col pt-2">
          {/* Brand row — matches the header height so both baselines line up. */}
          <div
            className={`flex h-15 shrink-0 items-center px-4 ${
              collapsed ? 'justify-center' : 'gap-2'
            }`}
          >
            {collapsed ? null : (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
                  <Bread size={16} />
                </span>
                <span className="truncate text-base font-semibold text-ink">Toastly</span>
              </>
            )}
            <Button
              type="text"
              size="small"
              className={collapsed ? '' : 'ml-auto'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((value) => !value)}
              icon={<SidebarSimple size={18} className="text-ink-muted" />}
            />
          </div>

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
                <Link href={entry.href} className="flex items-center justify-between gap-2">
                  <span className="truncate">{entry.title}</span>
                  {entry.meta ? (
                    <span className="text-xs text-ink-muted">{entry.meta}</span>
                  ) : null}
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
                notificationCount > 0 ? (
                  <Badge count={notificationCount} size="small" />
                ) : null
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
        </div>
      </Sider>

      {/* The sidebar bleeds into the page background; the only border in the
       * shell is the one wrapping this panel. */}
      <div className="flex min-w-0 flex-1 flex-col p-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
          <header className="flex h-15 shrink-0 items-center gap-1 border-b border-line px-4">
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

          <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </Layout>
  );
}
