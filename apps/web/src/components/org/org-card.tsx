'use client';

import { DotsThree, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { Dropdown, Skeleton } from 'antd';
import Link from 'next/link';

/** Shared grid classes so every unit-switcher dashboard's card layout lines
 * up the same way as the inventory tab's. */
export const ORG_GRID_CLASSES = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';

type IconComponent = React.ComponentType<{
  size?: number;
  className?: string;
  weight?: 'regular' | 'fill';
}>;

export interface OrgCardAction {
  key: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

interface OrgCardProps {
  Icon: IconComponent;
  title: string;
  subtitle?: string;
  badge?: { label: string; tone: 'neutral' | 'warning' | 'danger' };
  /** Present when the card drills into a child list. */
  href?: string;
  actions?: OrgCardAction[];
}

const BADGE_TONE_CLASSES: Record<NonNullable<OrgCardProps['badge']>['tone'], string> = {
  neutral: 'bg-fill text-ink-soft',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
};

/** One org-tree entity — district, division, area or club — rendered as a
 * card. Clicking the body drills down when `href` is set; the kebab menu
 * carries the actions the current dashboard allows (edit, move, delete). */
export function OrgCard({ Icon, title, subtitle, badge, href, actions }: OrgCardProps) {
  const body = (
    <div className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill text-ink-soft"
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-ink" title={title}>
            {title}
          </p>
          {badge ? (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${BADGE_TONE_CLASSES[badge.tone]}`}
            >
              {badge.label}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p> : null}
      </div>
    </div>
  );

  return (
    <div className="relative flex items-stretch overflow-hidden rounded-xl border border-line bg-canvas transition-shadow hover:shadow-md">
      {href ? (
        <Link
          href={href}
          className="min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      {actions && actions.length > 0 ? (
        <div className="flex shrink-0 items-start pt-2.5 pr-2">
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: actions.map((action) => ({
                key: action.key,
                label: action.label,
                danger: action.danger,
                onClick: ({ domEvent }) => {
                  domEvent.stopPropagation();
                  action.onClick();
                },
              })),
            }}
          >
            <button
              type="button"
              aria-label={`Actions for ${title}`}
              onClick={(event) => event.stopPropagation()}
              className="flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-fill hover:text-ink"
            >
              <DotsThree size={18} weight="bold" />
            </button>
          </Dropdown>
        </div>
      ) : null}
    </div>
  );
}

export function OrgGridSkeleton() {
  return (
    <div className={ORG_GRID_CLASSES} aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
          key={index}
          className="rounded-xl border border-line bg-canvas px-4 py-3.5"
        >
          <Skeleton
            active
            title={{ width: '60%' }}
            paragraph={{ rows: 1 }}
            avatar={{ shape: 'square' }}
          />
        </div>
      ))}
    </div>
  );
}

interface OrgGridErrorProps {
  message: string;
  onRetry: () => void;
}

export function OrgGridError({ message, onRetry }: OrgGridErrorProps) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
      <span
        aria-hidden
        className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
      >
        <WarningCircle size={18} weight="bold" />
      </span>
      <p className="text-sm font-medium text-ink">Could not load this list</p>
      <p className="mt-1 text-xs text-ink-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg border border-line px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-fill"
      >
        Try again
      </button>
    </div>
  );
}

interface OrgGridEmptyProps {
  Icon: IconComponent;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function OrgGridEmpty({ Icon, title, description, action }: OrgGridEmptyProps) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
      <span
        aria-hidden
        className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
      >
        <Icon size={18} weight="regular" />
      </span>
      <p className="text-sm text-ink-soft">{title}</p>
      <p className="mt-1 text-xs text-ink-muted">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
