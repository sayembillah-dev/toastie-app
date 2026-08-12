'use client';

import { CloudArrowUp, Image as ImageIcon, X } from '@phosphor-icons/react/dist/ssr';
import type { UploadFile, UploadProps } from 'antd';
import { App, Button, Input, Modal, Upload } from 'antd';
import NextImage from 'next/image';
import { useEffect, useState } from 'react';

import { ReadOnly } from '@/components/permissions/read-only';
import {
  ASSET_FILE_MAX_BYTES,
  ASSET_MIME_TYPES,
  ASSET_TITLE_MAX,
  type AssetMimeType,
  isAssetMimeType,
} from '@/lib/library/assets';
import { uploadFile } from '@/lib/uploads';
import { useCreateAssetMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface AssetUploadModalProps {
  open: boolean;
  onClose: () => void;
}

/** Local upload draft.
 *
 * Holds the `File` rather than its bytes: nothing is sent anywhere until the
 * user commits, and then `uploadFile` streams it straight to S3. `previewUrl`
 * is a local `blob:` URL purely for the on-screen preview — it never reaches
 * the server and is revoked when the draft is replaced or the modal closes.
 *
 * Width/height are measured client-side because S3 does not report image
 * dimensions back, and the `Asset` row wants them. */
interface Draft {
  title: string;
  file: File;
  previewUrl: string;
  mimeType: AssetMimeType;
  width: number;
  height: number;
  sizeBytes: number;
  fileName: string;
}

/** MIME-type filter for the file picker. Matches `ASSET_MIME_TYPES` on the
 * server so the same set holds on both ends of the wire. */
const ACCEPT = ASSET_MIME_TYPES.join(',');

/** Reads the natural pixel dimensions off a local object URL. Kept out of the
 * render path so an oversized image can't stretch the modal before it lands. */
function measureImage(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not decode the image'));
    img.src = objectUrl;
  });
}

/** Upload dialog. The Modal is a thin shell; all form state lives in the
 * inner body which `destroyOnHidden` unmounts every time the dialog closes,
 * so re-opening always lands on a blank form without needing a reset effect. */
export function AssetUploadModal({ open, onClose }: AssetUploadModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title="Upload asset" footer={null} destroyOnHidden>
      <UploadBody onDone={onClose} onCancel={onClose} />
    </Modal>
  );
}

interface UploadBodyProps {
  onDone: () => void;
  onCancel: () => void;
}

function UploadBody({ onDone, onCancel }: UploadBodyProps) {
  const { message } = App.useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [createAsset, { isLoading: isSaving }] = useCreateAssetMutation();

  /* Frees the previous preview when the draft is replaced, and the current
   * one when the dialog closes (`destroyOnHidden` unmounts this body). Done
   * in an effect rather than inside the `setDraft` updater so the updater
   * stays pure — StrictMode calls it twice. */
  useEffect(() => {
    if (!draft) return;
    return () => URL.revokeObjectURL(draft.previewUrl);
  }, [draft]);

  const handleBeforeUpload: NonNullable<UploadProps['beforeUpload']> = async (file) => {
    if (!isAssetMimeType(file.type)) {
      message.error('Please choose a PNG, JPEG, WEBP or GIF image');
      return Upload.LIST_IGNORE;
    }
    if (file.size > ASSET_FILE_MAX_BYTES) {
      const mb = (ASSET_FILE_MAX_BYTES / (1024 * 1024)).toFixed(0);
      message.error(`Please choose an image under ${mb} MB`);
      return Upload.LIST_IGNORE;
    }
    setBusy(true);
    const previewUrl = URL.createObjectURL(file);
    try {
      const { width, height } = await measureImage(previewUrl);
      setDraft((prev) => ({
        title: prev?.title ?? file.name.replace(/\.[^.]+$/, ''),
        file,
        previewUrl,
        mimeType: file.type as AssetMimeType,
        width,
        height,
        sizeBytes: file.size,
        fileName: file.name,
      }));
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      message.error(getApiErrorMessage(error, 'Could not read the image'));
    } finally {
      setBusy(false);
    }
    /* Returning false keeps antd from posting anywhere — the image is already
     * captured into `draft` and will be sent by our mutation. */
    return false;
  };

  const fileList: UploadFile[] = draft
    ? [
        {
          uid: 'draft',
          name: draft.fileName,
          status: 'done',
        },
      ]
    : [];

  const trimmedTitle = draft?.title.trim() ?? '';
  const canSave = draft !== null && trimmedTitle.length > 0 && !isSaving && !busy;

  /* Bytes move on save, not on pick. Uploading eagerly would give a livelier
   * preview, but every cancelled dialog would leave an object in the bucket
   * that nothing references and nothing can safely sweep — the row is the
   * only record that a key is still in use. */
  const handleSave = async () => {
    if (!draft || !canSave) return;
    setBusy(true);
    try {
      const imageUrl = await uploadFile(draft.file, 'asset');
      await createAsset({
        title: trimmedTitle,
        imageUrl,
        mimeType: draft.mimeType,
        width: draft.width,
        height: draft.height,
        sizeBytes: draft.sizeBytes,
      }).unwrap();
      message.success('Asset uploaded');
      onDone();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not upload the image'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {draft ? (
        <div className="relative overflow-hidden rounded-lg border border-line bg-fill">
          <div
            className="relative w-full"
            style={{ paddingTop: `${Math.min(75, (draft.height / draft.width) * 100)}%` }}
          >
            <NextImage
              src={draft.previewUrl}
              alt=""
              fill
              unoptimized
              className="object-contain"
              sizes="(max-width: 640px) 100vw, 480px"
            />
          </div>
          <Button
            type="text"
            size="small"
            aria-label="Remove image"
            onClick={() => setDraft(null)}
            icon={<X size={14} />}
            className="!absolute top-2 right-2 !bg-canvas/90"
          />
        </div>
      ) : (
        <Upload.Dragger
          accept={ACCEPT}
          multiple={false}
          fileList={fileList}
          beforeUpload={handleBeforeUpload}
          showUploadList={false}
          disabled={busy}
        >
          <p className="mb-2 flex justify-center text-ink-soft">
            <CloudArrowUp size={32} weight="regular" />
          </p>
          <p className="text-sm font-medium text-ink">Click or drag an image here</p>
          <p className="mt-1 text-xs text-ink-muted">
            PNG, JPEG, WEBP or GIF · up to {(ASSET_FILE_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB
          </p>
        </Upload.Dragger>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="asset-title" className="text-sm font-medium text-ink">
          Title
        </label>
        <Input
          id="asset-title"
          placeholder="Give this asset a name"
          value={draft?.title ?? ''}
          maxLength={ASSET_TITLE_MAX}
          showCount
          disabled={!draft}
          prefix={<ImageIcon size={14} className="text-ink-muted" />}
          onChange={(event) =>
            setDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))
          }
          onPressEnter={handleSave}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <ReadOnly resource="library" action="create">
          <Button
            type="primary"
            disabled={!canSave}
            loading={isSaving || busy}
            onClick={handleSave}
          >
            Upload
          </Button>
        </ReadOnly>
      </div>
    </div>
  );
}
