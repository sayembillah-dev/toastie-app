'use client';

import { Check, DownloadSimple, PencilSimple, Trash, X } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Input, Modal, Popconfirm, Space, Typography } from 'antd';
import NextImage from 'next/image';
import { useState } from 'react';
import { ReadOnly } from '@/components/permissions/read-only';

import { ASSET_TITLE_MAX, type Asset } from '@/lib/library/assets';
import { useDeleteAssetMutation, useUpdateAssetMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const { Text } = Typography;

interface AssetPreviewModalProps {
  asset: Asset | null;
  open: boolean;
  onClose: () => void;
}

/** Turns 240000 into "240 KB", 3145728 into "3.0 MB". Approximate is fine —
 * the number is a size hint, not a billing figure. */
function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Derives a filesystem-safe filename from the title, falling back to the
 * asset id. Extension comes from the stored MIME type — `image/jpeg` → `jpg`. */
function extensionFor(mimeType: string): string {
  const [, sub = 'png'] = mimeType.split('/');
  return sub === 'jpeg' ? 'jpg' : sub;
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/** Preview overlay. The Modal is only a shell — all local state (edit mode,
 * draft title) lives in the inner body, which `destroyOnHidden` unmounts on
 * close so the next open lands on a clean slate without needing a reset
 * effect. */
export function AssetPreviewModal({ asset, open, onClose }: AssetPreviewModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={null}
      footer={null}
      width={720}
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
    >
      {asset ? <PreviewBody asset={asset} onClose={onClose} /> : null}
    </Modal>
  );
}

interface PreviewBodyProps {
  asset: Asset;
  onClose: () => void;
}

function PreviewBody({ asset, onClose }: PreviewBodyProps) {
  const { message } = App.useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(asset.title);
  const [updateAsset, { isLoading: isSaving }] = useUpdateAssetMutation();
  const [deleteAsset, { isLoading: isDeleting }] = useDeleteAssetMutation();

  const trimmedTitle = draftTitle.trim();
  const canSave = trimmedTitle.length > 0 && trimmedTitle !== asset.title && !isSaving;

  const handleSaveTitle = async () => {
    if (!canSave) return;
    try {
      await updateAsset({ assetId: asset.id, title: trimmedTitle }).unwrap();
      message.success('Title updated');
      setIsEditing(false);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not update the title'));
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setDraftTitle(asset.title);
  };

  const handleDelete = async () => {
    try {
      await deleteAsset(asset.id).unwrap();
      message.success('Asset deleted');
      onClose();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not delete the asset'));
    }
  };

  const handleDownload = () => {
    const safeTitle = asset.title.replace(/[^\w\d-]+/g, '-').replace(/^-+|-+$/g, '') || asset.id;
    downloadDataUrl(asset.imageUrl, `${safeTitle}.${extensionFor(asset.mimeType)}`);
  };

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        {isEditing ? (
          <>
            <Input
              autoFocus
              value={draftTitle}
              maxLength={ASSET_TITLE_MAX}
              onChange={(event) => setDraftTitle(event.target.value)}
              onPressEnter={handleSaveTitle}
              onKeyDown={(event) => {
                if (event.key === 'Escape') handleCancelEdit();
              }}
              className="flex-1"
            />
            <Button
              type="text"
              size="small"
              aria-label="Cancel edit"
              icon={<X size={16} />}
              onClick={handleCancelEdit}
            />
            <Button
              type="primary"
              size="small"
              aria-label="Save title"
              icon={<Check size={16} />}
              disabled={!canSave}
              loading={isSaving}
              onClick={handleSaveTitle}
            />
          </>
        ) : (
          <>
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
              {asset.title}
            </h2>
            <ReadOnly resource="library">
              <Button
                type="text"
                size="small"
                aria-label="Edit title"
                icon={<PencilSimple size={16} className="text-ink-soft" />}
                onClick={() => setIsEditing(true)}
              />
            </ReadOnly>
          </>
        )}
      </header>

      <div className="flex items-center justify-center bg-fill p-2">
        <div
          className="relative w-full"
          /* Aspect-ratio box — keeps the modal from resizing between images. */
          style={{
            paddingTop: `${Math.min(80, (asset.height / asset.width) * 100)}%`,
          }}
        >
          <NextImage
            src={asset.imageUrl}
            alt={asset.title}
            fill
            unoptimized
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 720px"
          />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
        <Text className="text-xs text-ink-muted">
          {asset.width} × {asset.height} · {formatBytes(asset.sizeBytes)}
        </Text>
        <Space size="small">
          <ReadOnly resource="library" action="delete">
            <Popconfirm
              title="Delete this asset?"
              description="This cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true, loading: isDeleting }}
              cancelText="Cancel"
              onConfirm={handleDelete}
            >
              <Button danger size="small" icon={<Trash size={14} />}>
                Delete
              </Button>
            </Popconfirm>
          </ReadOnly>
          <Button
            type="primary"
            size="small"
            icon={<DownloadSimple size={14} />}
            onClick={handleDownload}
          >
            Download
          </Button>
        </Space>
      </footer>
    </div>
  );
}
