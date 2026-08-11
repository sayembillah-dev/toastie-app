'use client';

import { CloudArrowUp, FileText, X } from '@phosphor-icons/react/dist/ssr';
import type { UploadFile, UploadProps } from 'antd';
import { App, Button, Input, Modal, Upload } from 'antd';
import { useState } from 'react';

import { DocumentIcon } from '@/components/library/document-icon';
import {
  DOCUMENT_FILE_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  DOCUMENT_TITLE_MAX,
  type DocumentMimeType,
  documentTypeLabel,
  isDocumentMimeType,
} from '@/lib/library/documents';
import { uploadFile } from '@/lib/uploads';
import { useCreateDocumentMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
}

/** Local upload draft.
 *
 * Holds the `File` itself: the preview card is an icon plus a filename, so
 * unlike an image there is nothing to decode up front. The bytes go to S3
 * on save via `uploadFile`, never through this app. */
interface Draft {
  title: string;
  fileName: string;
  file: File;
  mimeType: DocumentMimeType;
  sizeBytes: number;
}

/** MIME-type filter for the file picker. Matches `DOCUMENT_MIME_TYPES` on the
 * server so the same set holds on both ends of the wire. */
const ACCEPT = DOCUMENT_MIME_TYPES.join(',');

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Upload dialog. The Modal is a thin shell; all form state lives in the
 * inner body which `destroyOnHidden` unmounts every time the dialog closes,
 * so re-opening always lands on a blank form without needing a reset effect. */
export function DocumentUploadModal({ open, onClose }: DocumentUploadModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title="Upload document" footer={null} destroyOnHidden>
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
  const [createDocument, { isLoading: isSaving }] = useCreateDocumentMutation();

  const handleBeforeUpload: NonNullable<UploadProps['beforeUpload']> = async (file) => {
    if (!isDocumentMimeType(file.type)) {
      message.error('Please choose a PDF, Word, Excel, PowerPoint, text, CSV or Zip file');
      return Upload.LIST_IGNORE;
    }
    if (file.size > DOCUMENT_FILE_MAX_BYTES) {
      const mb = (DOCUMENT_FILE_MAX_BYTES / (1024 * 1024)).toFixed(0);
      message.error(`Please choose a file under ${mb} MB`);
      return Upload.LIST_IGNORE;
    }
    setDraft((prev) => ({
      title: prev?.title ?? file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      file,
      mimeType: file.type as DocumentMimeType,
      sizeBytes: file.size,
    }));
    /* Returning false keeps antd from posting anywhere — the file is already
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

  /* Bytes move on save, not on pick — see the matching note in
   * `asset-upload-modal.tsx` for why. */
  const handleSave = async () => {
    if (!draft || !canSave) return;
    setBusy(true);
    try {
      const fileUrl = await uploadFile(draft.file, 'document');
      await createDocument({
        title: trimmedTitle,
        fileName: draft.fileName,
        fileUrl,
        mimeType: draft.mimeType,
        sizeBytes: draft.sizeBytes,
      }).unwrap();
      message.success('Document uploaded');
      onDone();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not upload the document'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {draft ? (
        <div className="relative flex items-center gap-3 rounded-lg border border-line bg-fill p-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-canvas">
            <DocumentIcon mimeType={draft.mimeType} size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink" title={draft.fileName}>
              {draft.fileName}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {documentTypeLabel(draft.mimeType)} · {formatBytes(draft.sizeBytes)}
            </p>
          </div>
          <Button
            type="text"
            size="small"
            aria-label="Remove file"
            onClick={() => setDraft(null)}
            icon={<X size={14} />}
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
          <p className="text-sm font-medium text-ink">Click or drag a file here</p>
          <p className="mt-1 text-xs text-ink-muted">
            PDF, Word, Excel, PowerPoint, text, CSV or Zip · up to{' '}
            {(DOCUMENT_FILE_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB
          </p>
        </Upload.Dragger>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="document-title" className="text-sm font-medium text-ink">
          Title
        </label>
        <Input
          id="document-title"
          placeholder="Give this document a name"
          value={draft?.title ?? ''}
          maxLength={DOCUMENT_TITLE_MAX}
          showCount
          disabled={!draft}
          prefix={<FileText size={14} className="text-ink-muted" />}
          onChange={(event) =>
            setDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))
          }
          onPressEnter={handleSave}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" disabled={!canSave} loading={isSaving || busy} onClick={handleSave}>
          Upload
        </Button>
      </div>
    </div>
  );
}
