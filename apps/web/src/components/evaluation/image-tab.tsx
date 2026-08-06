'use client';

import { Camera, ImageSquare, TrashSimple, UploadSimple } from '@phosphor-icons/react/dist/ssr';
import { App, Button } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_IMAGES = 8;
const MAX_FILE_MB = 12;

interface ImageTabProps {
  images: File[];
  onChange: (images: File[]) => void;
}

interface Thumb {
  key: string;
  url: string;
}

/** Thin wrapper around a plain <img>. Extracted so the biome/next-img
 * suppressions apply to a single, obvious line — thumbnails are blob URLs,
 * which next/image can't optimise without a custom loader. */
function Thumbnail({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="aspect-square w-full object-cover" />;
}

/** Multi-image drop / picker. Images stay client-side until the parent submits;
 * we build preview URLs from the File objects and revoke them on unmount. */
export function ImageTab({ images, onChange }: ImageTabProps) {
  const { message } = App.useApp();
  const [dragActive, setDragActive] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /* Thumbs are derived from the file list rather than mirrored into their own
   * state — the paired effect below just revokes the object URLs on the next
   * change or on unmount. */
  const thumbs = useMemo<Thumb[]>(
    () =>
      images.map((file, index) => ({
        key: `${index}-${file.name}-${file.size}-${file.lastModified}`,
        url: URL.createObjectURL(file),
      })),
    [images],
  );
  useEffect(() => {
    return () => {
      for (const thumb of thumbs) URL.revokeObjectURL(thumb.url);
    };
  }, [thumbs]);

  function ingest(files: FileList | File[] | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      message.info(`You can attach up to ${MAX_IMAGES} images.`);
      return;
    }

    const oversized: string[] = [];
    const nonImage: string[] = [];
    const accepted: File[] = [];

    for (const file of incoming.slice(0, room)) {
      if (!file.type.startsWith('image/')) {
        nonImage.push(file.name);
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        oversized.push(file.name);
        continue;
      }
      accepted.push(file);
    }

    if (nonImage.length > 0) message.warning(`Skipped non-image files: ${nonImage.join(', ')}`);
    if (oversized.length > 0)
      message.warning(`Skipped files over ${MAX_FILE_MB} MB: ${oversized.join(', ')}`);

    if (accepted.length > 0) onChange([...images, ...accepted]);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    ingest(event.dataTransfer.files);
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  const remaining = MAX_IMAGES - images.length;

  return (
    <div className="flex flex-col gap-4">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard interaction is on the buttons inside — pointer drag is an alternate path only. */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          dragActive ? 'border-ink bg-fill/60' : 'border-line-strong bg-sidebar hover:border-ink/40'
        }`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill text-ink-soft">
          <ImageSquare size={22} />
        </div>
        <p className="mt-3 text-sm font-medium text-ink">
          Snap your evaluation form or handwritten notes
        </p>
        <p className="mt-1 text-[12px] text-ink-muted">
          Drag files here, or use a button below. Up to {MAX_IMAGES} images, {MAX_FILE_MB} MB each.
        </p>

        <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            icon={<Camera size={16} weight="bold" />}
            onClick={() => cameraInputRef.current?.click()}
            disabled={remaining <= 0}
          >
            Take a photo
          </Button>
          <Button
            type="primary"
            icon={<UploadSimple size={16} weight="bold" />}
            onClick={() => galleryInputRef.current?.click()}
            disabled={remaining <= 0}
          >
            Choose from device
          </Button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            ingest(event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            ingest(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {thumbs.length > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Attached ({thumbs.length}/{MAX_IMAGES})
          </p>
          {images.length > 0 ? (
            <Button size="small" type="text" onClick={() => onChange([])}>
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}

      {thumbs.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {thumbs.map((thumb, index) => (
            <li
              key={thumb.key}
              className="group relative overflow-hidden rounded-xl border border-line bg-fill"
            >
              <Thumbnail src={thumb.url} alt={`Attachment ${index + 1}`} />
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={`Remove attachment ${index + 1}`}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <TrashSimple size={14} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
