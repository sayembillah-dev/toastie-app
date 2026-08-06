'use client';

import {
  FileText,
  List as ListIcon,
  MagnifyingGlass,
  Plus,
  SquaresFour,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Input, Segmented, Skeleton, Spin } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DocumentIcon } from '@/components/library/document-icon';
import { DocumentPreviewModal } from '@/components/library/document-preview-modal';
import { DocumentUploadModal } from '@/components/library/document-upload-modal';
import type { LibraryDocument } from '@/lib/library/documents';
import { documentTypeLabel } from '@/lib/library/documents';
import { usePermission } from '@/lib/permissions/use-permission';
import { useListDocumentsQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/** How long to wait after the last keystroke before the search fires. Short
 * enough to feel live, long enough to avoid a page refetch on every letter. */
const SEARCH_DEBOUNCE_MS = 200;

type DocumentView = 'grid' | 'list';

interface DocumentsTabProps {
  /** Applied by the parent tab wrapper. Optional so the component can stand
   * on its own in a story or a test page. */
  className?: string;
}

/** Library › Documents. Search leads, the view toggle and upload button sit
 * on the right. The body renders either a card grid or a table-like list, so
 * viewers can scan by title-card when browsing and switch to a dense list
 * when looking for something by name. Infinite scroll uses an
 * IntersectionObserver on a sentinel so the body keeps fetching as long as
 * the sentinel is on-screen. */
export function DocumentsTab({ className }: DocumentsTabProps) {
  const { mutate: canMutate } = usePermission('library');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<DocumentView>('grid');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<LibraryDocument | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const { data, isFetching, isLoading, isError, error, refetch } = useListDocumentsQuery({
    q: debouncedQuery,
    offset,
  });

  const items = data?.items ?? [];
  const nextOffset = data?.nextOffset ?? null;
  const canLoadMore = nextOffset !== null && !isFetching && !isError;

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

  /* Deterministic placeholder heights so the loading grid feels like real
   * cards without pulling in randomness that would jitter across hydrations. */
  const skeletonKeys = useMemo(() => Array.from({ length: 8 }, (_, index) => index), []);

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Input
            allowClear
            size="middle"
            placeholder="Search by title or filename"
            aria-label="Search documents"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
          />
        </div>
        <div className="flex items-center gap-2">
          <Segmented<DocumentView>
            value={view}
            onChange={setView}
            options={[
              {
                value: 'grid',
                title: 'Grid view',
                label: (
                  <span className="inline-flex items-center">
                    <SquaresFour size={16} weight="bold" aria-hidden />
                    <span className="sr-only">Grid view</span>
                  </span>
                ),
              },
              {
                value: 'list',
                title: 'List view',
                label: (
                  <span className="inline-flex items-center">
                    <ListIcon size={16} weight="bold" aria-hidden />
                    <span className="sr-only">List view</span>
                  </span>
                ),
              },
            ]}
          />
          <Button
            type="primary"
            icon={<Plus size={14} />}
            disabled={!canMutate}
            onClick={() => setUploadOpen(true)}
          >
            Upload
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <WarningCircle size={18} weight="bold" />
          </span>
          <p className="text-sm font-medium text-ink">Could not load the documents</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
          <Button className="mt-4" size="small" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {isLoading && !isError ? (
        view === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {skeletonKeys.map((key) => (
              <div key={key} className="rounded-xl border border-line bg-canvas p-4" aria-hidden>
                <Skeleton
                  active
                  title={{ width: '60%' }}
                  paragraph={{ rows: 2, width: ['80%', '40%'] }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-canvas" aria-hidden>
            {skeletonKeys.map((key, index) => (
              <div
                key={key}
                className={`flex items-center gap-3 px-4 py-3 ${
                  index > 0 ? 'border-t border-line' : ''
                }`}
              >
                <Skeleton.Avatar active size={28} shape="square" />
                <Skeleton active title={{ width: '40%' }} paragraph={false} />
              </div>
            ))}
          </div>
        )
      ) : null}

      {showEmpty ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <FileText size={18} weight="bold" />
          </span>
          {hasQuery ? (
            <>
              <p className="text-sm text-ink-soft">
                No documents match{' '}
                <span className="font-medium text-ink">&ldquo;{debouncedQuery}&rdquo;</span>.
              </p>
              <p className="mt-1 text-xs text-ink-muted">Try a different title or filename.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-soft">No documents uploaded yet.</p>
              <p className="mt-1 text-xs text-ink-muted">
                Upload minutes, agendas or handouts to get started.
              </p>
              <Button
                type="primary"
                size="small"
                icon={<Plus size={14} />}
                className="mt-4"
                disabled={!canMutate}
                onClick={() => setUploadOpen(true)}
              >
                Upload document
              </Button>
            </>
          )}
        </div>
      ) : null}

      {!isLoading && !isError && items.length > 0 ? (
        <>
          {view === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} onPreview={() => setPreviewDoc(doc)} />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-canvas">
              <div className="hidden grid-cols-[minmax(0,1fr)_100px_100px_140px] gap-3 border-b border-line bg-fill px-4 py-2 text-xs font-medium text-ink-muted uppercase tracking-wide sm:grid">
                <span>Name</span>
                <span>Type</span>
                <span>Size</span>
                <span>Added</span>
              </div>
              <ul className="flex flex-col">
                {items.map((doc, index) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onPreview={() => setPreviewDoc(doc)}
                    hasBorder={index > 0}
                  />
                ))}
              </ul>
            </div>
          )}

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

      <DocumentUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <DocumentPreviewModal
        doc={previewDoc}
        open={previewDoc !== null}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}

/** Turns 240000 into "240 KB", 3145728 into "3.0 MB". Approximate is fine —
 * the number is a size hint, not a billing figure. */
function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human date for the "added" column — locale-formatted without the year so
 * the row stays short. Falls back to the raw string on unparseable input. */
function formatAddedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface DocumentCardProps {
  doc: LibraryDocument;
  onPreview: () => void;
}

/** Grid-view tile — the whole surface is a button so the row is
 * keyboard-focusable and the hover state applies to the icon and text alike. */
function DocumentCard({ doc, onPreview }: DocumentCardProps) {
  return (
    <button
      type="button"
      onClick={onPreview}
      className="group flex flex-col items-start gap-3 rounded-xl border border-line bg-canvas p-4 text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      <div className="flex size-12 items-center justify-center rounded-lg bg-fill">
        <DocumentIcon mimeType={doc.mimeType} size={28} />
      </div>
      <div className="w-full min-w-0">
        <p className="truncate text-sm font-medium text-ink" title={doc.title}>
          {doc.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-muted" title={doc.fileName}>
          {doc.fileName}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span className="rounded-md bg-fill px-2 py-0.5 font-medium text-ink-soft">
          {documentTypeLabel(doc.mimeType)}
        </span>
        <span>{formatBytes(doc.sizeBytes)}</span>
      </div>
    </button>
  );
}

interface DocumentRowProps {
  doc: LibraryDocument;
  onPreview: () => void;
  hasBorder: boolean;
}

/** List-view row — a single button spans the row so the entire strip is
 * clickable, mirroring how a file manager treats a row. */
function DocumentRow({ doc, onPreview, hasBorder }: DocumentRowProps) {
  return (
    <li className={hasBorder ? 'border-t border-line' : ''}>
      <button
        type="button"
        onClick={onPreview}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-fill focus:outline-none focus-visible:bg-fill sm:grid-cols-[minmax(0,1fr)_100px_100px_140px]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill">
            <DocumentIcon mimeType={doc.mimeType} size={20} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink" title={doc.title}>
              {doc.title}
            </span>
            <span className="block truncate text-xs text-ink-muted" title={doc.fileName}>
              {doc.fileName}
            </span>
          </span>
        </span>
        <span className="hidden text-xs text-ink-soft sm:inline">
          <span className="rounded-md bg-fill px-2 py-0.5 font-medium">
            {documentTypeLabel(doc.mimeType)}
          </span>
        </span>
        <span className="hidden text-xs text-ink-muted sm:inline sm:justify-self-start">
          {formatBytes(doc.sizeBytes)}
        </span>
        <span className="text-right text-xs text-ink-muted sm:text-left sm:justify-self-start">
          {formatAddedAt(doc.createdAt)}
        </span>
      </button>
    </li>
  );
}
