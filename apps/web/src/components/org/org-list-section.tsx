'use client';

import { Plus } from '@phosphor-icons/react/dist/ssr';
import type { ResourceKey } from '@toastly/access';
import { Button } from 'antd';
import { Fragment } from 'react';
import { StaggerList } from '@/components/motion/stagger-list';
import { ReadOnly } from '@/components/permissions/read-only';
import { getApiErrorMessage } from '@/store/api-error';

import { ORG_GRID_CLASSES, OrgGridEmpty, OrgGridError, OrgGridSkeleton } from './org-card';

type IconComponent = React.ComponentType<{
  size?: number;
  className?: string;
  weight?: 'regular' | 'fill';
}>;

interface OrgListSectionProps<T> {
  title: string;
  subtitle?: string;
  items: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  getKey: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  emptyIcon: IconComponent;
  emptyTitle: string;
  emptyDescription: string;
  addLabel: string;
  onAdd: () => void;
  /** What the Add button creates. Defaults to a unit in the org tree; the
   * clubs list passes `club`, which directors are granted separately. */
  addResource?: ResourceKey;
}

/** One drill-down level of a unit-switcher dashboard — a titled header with
 * an "Add" button, then the card grid in whichever of loading/error/empty/
 * populated state it's in. Shared by every District/Division/Area/Super
 * Admin list: districts, divisions, areas and clubs all render through this,
 * just with a different card renderer and empty-state copy. */
export function OrgListSection<T>({
  title,
  subtitle,
  items,
  isLoading,
  isError,
  error,
  onRetry,
  getKey,
  renderCard,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  addLabel,
  onAdd,
  addResource = 'orgUnit',
}: OrgListSectionProps<T>) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-ink-soft">{subtitle}</p> : null}
        </div>
        <ReadOnly resource={addResource} action="create">
          <Button type="primary" icon={<Plus size={14} />} onClick={onAdd}>
            {addLabel}
          </Button>
        </ReadOnly>
      </div>

      {isError ? <OrgGridError message={getApiErrorMessage(error)} onRetry={onRetry} /> : null}

      {isLoading && !isError ? <OrgGridSkeleton /> : null}

      {!isLoading && !isError && (items?.length ?? 0) === 0 ? (
        <OrgGridEmpty
          Icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <ReadOnly resource={addResource} action="create">
              <Button type="primary" size="small" icon={<Plus size={14} />} onClick={onAdd}>
                {addLabel}
              </Button>
            </ReadOnly>
          }
        />
      ) : null}

      {!isLoading && !isError && items && items.length > 0 ? (
        <StaggerList className={ORG_GRID_CLASSES}>
          {items.map((item) => (
            <Fragment key={getKey(item)}>{renderCard(item)}</Fragment>
          ))}
        </StaggerList>
      ) : null}
    </div>
  );
}
