'use client';

import { Check, DownloadSimple, PencilSimple, Trash, X } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Input, Modal, Popconfirm, Space, Typography } from 'antd';
import { useState } from 'react';
import { DocumentIcon } from '@/components/library/document-icon';
import { ReadOnly } from '@/components/permissions/read-only';
import {
  DOCUMENT_TITLE_MAX,
  documentExtension,
  documentTypeLabel,
  type LibraryDocument,
} from '@/lib/library/documents';
import { useDeleteDocumentMutation, useUpdateDocumentMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const { Text } = Typography;

interface DocumentPreviewModalProps {
  doc: LibraryDocument | null;
  open: boolean;
  onClose: () => void;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAddedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
 * close so the next open lands on a clean slate. */
export function DocumentPreviewModal({ doc, open, onClose }: DocumentPreviewModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={null}
      footer={null}
      width={560}
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
    >
      {doc ? <PreviewBody doc={doc} onClose={onClose} /> : null}
    </Modal>
  );
}

interface PreviewBodyProps {
  doc: LibraryDocument;
  onClose: () => void;
}

function PreviewBody({ doc, onClose }: PreviewBodyProps) {
  const { message } = App.useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(doc.title);
  const [updateDocument, { isLoading: isSaving }] = useUpdateDocumentMutation();
  const [deleteDocument, { isLoading: isDeleting }] = useDeleteDocumentMutation();

  const trimmedTitle = draftTitle.trim();
  const canSave = trimmedTitle.length > 0 && trimmedTitle !== doc.title && !isSaving;

  const handleSaveTitle = async () => {
    if (!canSave) return;
    try {
      await updateDocument({ documentId: doc.id, title: trimmedTitle }).unwrap();
      message.success('Title updated');
      setIsEditing(false);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not update the title'));
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setDraftTitle(doc.title);
  };

  const handleDelete = async () => {
    try {
      await deleteDocument(doc.id).unwrap();
      message.success('Document deleted');
      onClose();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not delete the document'));
    }
  };

  const handleDownload = () => {
    const safeTitle = doc.title.replace(/[^\w\d-]+/g, '-').replace(/^-+|-+$/g, '') || doc.id;
    downloadDataUrl(doc.fileUrl, `${safeTitle}.${documentExtension(doc)}`);
  };

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        {isEditing ? (
          <>
            <Input
              autoFocus
              value={draftTitle}
              maxLength={DOCUMENT_TITLE_MAX}
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
              {doc.title}
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

      <div className="flex items-center gap-4 bg-fill px-6 py-8">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-canvas">
          <DocumentIcon mimeType={doc.mimeType} size={40} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink" title={doc.fileName}>
            {doc.fileName}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {documentTypeLabel(doc.mimeType)} · {formatBytes(doc.sizeBytes)}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">Added {formatAddedAt(doc.createdAt)}</p>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
        <Text className="text-xs text-ink-muted">
          {doc.updatedAt ? `Edited ${formatAddedAt(doc.updatedAt)}` : ''}
        </Text>
        <Space size="small">
          <ReadOnly resource="library" action="delete">
            <Popconfirm
              title="Delete this document?"
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
