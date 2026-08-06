'use client';

import {
  ImageSquare,
  MagnifyingGlass,
  Package,
  Plus,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Input, Skeleton } from 'antd';
import NextImage from 'next/image';
import { useMemo, useState } from 'react';

import { InventoryItemModal } from '@/components/inventory/inventory-item-modal';
import type { InventoryItem } from '@/lib/inventory/inventory-items';
import { usePermission } from '@/lib/permissions/use-permission';
import { useListInventoryItemsQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const GRID_CLASSES = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';

function matchesQuery(item: InventoryItem, needle: string): boolean {
  const haystack = `${item.title} ${item.description ?? ''}`.toLowerCase();
  return haystack.includes(needle);
}

/** Inventory tab — a straightforward roster of the physical assets the club
 * owns. Each row has a title, an optional description and an optional image.
 * The list is small enough to fit in one endpoint and filter on the client. */
export function InventoryTab() {
  const { mutate: canMutate } = usePermission('inventory');
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const { data: items, isLoading, isError, error, refetch } = useListInventoryItemsQuery();

  const filtered = useMemo(() => {
    if (!items) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => matchesQuery(item, needle));
  }, [items, query]);

  const hasQuery = query.trim().length > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Input
            allowClear
            size="middle"
            placeholder="Search inventory"
            aria-label="Search inventory"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
          />
        </div>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          disabled={!canMutate}
          onClick={() => setAddOpen(true)}
        >
          Add item
        </Button>
      </div>

      {isError ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <WarningCircle size={18} weight="bold" />
          </span>
          <p className="text-sm font-medium text-ink">Could not load the inventory</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
          <Button className="mt-4" size="small" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {isLoading && !isError ? (
        <div className={GRID_CLASSES} aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
              key={index}
              className="overflow-hidden rounded-xl border border-line bg-canvas"
            >
              <Skeleton.Node active style={{ width: '100%', height: 140 }}>
                <span className="sr-only">Loading</span>
              </Skeleton.Node>
              <div className="px-3 py-3">
                <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 2 }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && !isError && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <Package size={18} weight="bold" />
          </span>
          {hasQuery ? (
            <>
              <p className="text-sm text-ink-soft">
                No items match{' '}
                <span className="font-medium text-ink">&ldquo;{query.trim()}&rdquo;</span>.
              </p>
              <p className="mt-1 text-xs text-ink-muted">Try a different search.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-soft">No inventory yet.</p>
              <p className="mt-1 text-xs text-ink-muted">
                Log the club&rsquo;s physical assets so nothing goes missing between meetings.
              </p>
              <Button
                type="primary"
                size="small"
                icon={<Plus size={14} />}
                className="mt-4"
                disabled={!canMutate}
                onClick={() => setAddOpen(true)}
              >
                Add item
              </Button>
            </>
          )}
        </div>
      ) : null}

      {!isLoading && !isError && filtered.length > 0 ? (
        <div className={GRID_CLASSES}>
          {filtered.map((item) => (
            <InventoryCard key={item.id} item={item} onEdit={() => setEditingItem(item)} />
          ))}
        </div>
      ) : null}

      <InventoryItemModal open={addOpen} item={null} onClose={() => setAddOpen(false)} />
      <InventoryItemModal
        open={editingItem !== null}
        item={editingItem}
        onClose={() => setEditingItem(null)}
      />
    </div>
  );
}

interface InventoryCardProps {
  item: InventoryItem;
  onEdit: () => void;
}

function InventoryCard({ item, onEdit }: InventoryCardProps) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full flex-col overflow-hidden rounded-xl border border-line bg-canvas text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      <div className="relative w-full bg-fill" style={{ paddingTop: '56%' }}>
        {item.imageUrl ? (
          <NextImage
            src={item.imageUrl}
            alt={item.title}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            loading="lazy"
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center text-ink-muted"
          >
            <ImageSquare size={32} weight="regular" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 px-3 py-3">
        <p className="truncate text-sm font-medium text-ink" title={item.title}>
          {item.title}
        </p>
        {item.description ? (
          <p className="line-clamp-2 text-xs text-ink-soft" title={item.description}>
            {item.description}
          </p>
        ) : (
          <p className="text-xs text-ink-muted">No description</p>
        )}
      </div>
    </button>
  );
}
