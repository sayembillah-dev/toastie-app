'use client';

import { ImageSquare, MagnifyingGlass, Plus, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { Button, Input, Skeleton, Spin } from 'antd';
import NextImage from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AssetPreviewModal } from '@/components/library/asset-preview-modal';
import { AssetUploadModal } from '@/components/library/asset-upload-modal';
import type { Asset } from '@/lib/library/assets';
import { usePermission } from '@/lib/permissions/use-permission';
import { useListAssetsQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/** How long to wait after the last keystroke before the search fires. Short
 * enough to feel live, long enough to avoid a page refetch on every letter. */
const SEARCH_DEBOUNCE_MS = 200;

/** CSS-columns masonry — one property does the whole grid, and every child
 * that gets `break-inside: avoid` slots neatly into the column that has the
 * shortest running height. Column count scales up with the viewport. */
const MASONRY_CLASSES =
  'columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5 [column-fill:_balance]';

interface AssetsTabProps {
  /** Applied by the parent tab wrapper. Optional so the component can stand
   * on its own in a story or a test page. */
  className?: string;
}

/** Library › Assets. Search leads, upload button on the right, masonry grid
 * fills the rest. Infinite scroll uses an IntersectionObserver on a sentinel
 * so the grid keeps fetching as long as the sentinel is on-screen. */
export function AssetsTab({ className }: AssetsTabProps) {
  const { mutate: canMutate } = usePermission('library');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  /* Debounce the search input — the local backend responds fast, but a real
   * network would rack up a request per keystroke. Also resets pagination so
   * a new query starts from the top of the grid rather than from wherever
   * the last one had scrolled to. */
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const { data, isFetching, isLoading, isError, error, refetch } = useListAssetsQuery({
    q: debouncedQuery,
    offset,
  });

  const items = data?.items ?? [];
  const nextOffset = data?.nextOffset ?? null;
  const canLoadMore = nextOffset !== null && !isFetching && !isError;

  /* IntersectionObserver-based infinite scroll. The sentinel is a 1px div at
   * the bottom of the grid; when it enters the viewport we bump the offset,
   * which triggers the query hook to fetch the next page and merge it into
   * the cache entry. */
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMore = useCallback(() => {
    if (!canLoadMore || nextOffset === null) return;
    setOffset(nextOffset);
  }, [canLoadMore, nextOffset]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) loadMore();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore]);

  const showEmpty = !isLoading && !isError && items.length === 0;
  const hasQuery = debouncedQuery.length > 0;

  const skeletonHeights = useMemo(
    /* Deterministic per-index heights so the placeholder grid looks like a
     * real masonry rather than a stack of identical cards, without pulling
     * in randomness that would jitter across hydrations. */
    () => [220, 160, 280, 200, 180, 260, 200, 240, 180, 220, 260, 200],
    [],
  );

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Input
            allowClear
            size="middle"
            placeholder="Search by title"
            aria-label="Search assets"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
          />
        </div>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          disabled={!canMutate}
          onClick={() => setUploadOpen(true)}
        >
          Upload
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
          <p className="text-sm font-medium text-ink">Could not load the assets</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
          <Button className="mt-4" size="small" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {isLoading && !isError ? (
        <div className={MASONRY_CLASSES} aria-hidden>
          {skeletonHeights.map((height, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
              key={index}
              className="mb-3 break-inside-avoid overflow-hidden rounded-xl border border-line bg-canvas"
            >
              <Skeleton.Node active style={{ width: '100%', height }}>
                <span className="sr-only">Loading</span>
              </Skeleton.Node>
              <div className="px-3 py-2">
                <Skeleton active title={{ width: '70%' }} paragraph={false} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <ImageSquare size={18} weight="bold" />
          </span>
          {hasQuery ? (
            <>
              <p className="text-sm text-ink-soft">
                No assets match{' '}
                <span className="font-medium text-ink">&ldquo;{debouncedQuery}&rdquo;</span>.
              </p>
              <p className="mt-1 text-xs text-ink-muted">Try a different title.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-soft">No assets uploaded yet.</p>
              <p className="mt-1 text-xs text-ink-muted">
                Upload a flyer, photo or template to get started.
              </p>
              <Button
                type="primary"
                size="small"
                icon={<Plus size={14} />}
                className="mt-4"
                disabled={!canMutate}
                onClick={() => setUploadOpen(true)}
              >
                Upload asset
              </Button>
            </>
          )}
        </div>
      ) : null}

      {!isLoading && !isError && items.length > 0 ? (
        <>
          <div className={MASONRY_CLASSES}>
            {items.map((asset) => (
              <AssetTile key={asset.id} asset={asset} onPreview={() => setPreviewAsset(asset)} />
            ))}
          </div>

          {/* Sentinel + spinner: the ref is what the observer watches, the
           * spinner is a hint that another page is on the way when the user
           * has scrolled past the last card. */}
          <div ref={sentinelRef} aria-hidden className="h-8" />
          {isFetching && offset > 0 ? (
            <div className="flex items-center justify-center py-6">
              <Spin size="small" />
            </div>
          ) : null}
          {nextOffset === null && offset > 0 ? (
            <p className="pt-4 pb-2 text-center text-xs text-ink-muted">That&rsquo;s everything.</p>
          ) : null}
        </>
      ) : null}

      <AssetUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <AssetPreviewModal
        asset={previewAsset}
        open={previewAsset !== null}
        onClose={() => setPreviewAsset(null)}
      />
    </div>
  );
}

interface AssetTileProps {
  asset: Asset;
  onPreview: () => void;
}

/** One tile in the masonry. The button wraps the whole card so the entire
 * surface is clickable and keyboard-focusable; the caption sits inside the
 * same button so hover state applies to both image and text. */
function AssetTile({ asset, onPreview }: AssetTileProps) {
  return (
    <button
      type="button"
      onClick={onPreview}
      className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border border-line bg-canvas text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      <div
        className="relative w-full bg-fill"
        /* Reserve the aspect box up front so the tile keeps its slot in the
         * column while the image decodes — no layout jump when the pixels
         * arrive over the network. */
        style={{ paddingTop: `${(asset.height / asset.width) * 100}%` }}
      >
        <NextImage
          src={asset.imageUrl}
          alt={asset.title}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
          className="object-cover"
          loading="lazy"
        />
      </div>
      <p className="truncate px-3 py-2 text-sm text-ink" title={asset.title}>
        {asset.title}
      </p>
    </button>
  );
}
