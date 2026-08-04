'use client';

import { CloudArrowUp, Image as ImageIcon, X } from '@phosphor-icons/react/dist/ssr';
import type { UploadProps } from 'antd';
import { App, Button, Input, Modal, Popconfirm, Upload } from 'antd';
import NextImage from 'next/image';
import { useState } from 'react';

import type { InventoryImageMimeType, InventoryItem } from '@/lib/inventory/inventory-items';
import {
  INVENTORY_DESCRIPTION_MAX,
  INVENTORY_IMAGE_MAX_BYTES,
  INVENTORY_IMAGE_MIME_TYPES,
  INVENTORY_TITLE_MAX,
  isInventoryImageMimeType,
} from '@/lib/inventory/inventory-items';
import {
  useCreateInventoryItemMutation,
  useDeleteInventoryItemMutation,
  useUpdateInventoryItemMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface InventoryItemModalProps {
  open: boolean;
  /** When present, the modal is in edit mode; when null, it creates a new row. */
  item: InventoryItem | null;
  onClose: () => void;
}

const ACCEPT = INVENTORY_IMAGE_MIME_TYPES.join(',');

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/** Add / edit dialog. Handles the create and update flow off a single form so
 * the two paths stay in sync — the parent decides which one by passing an
 * `item` or leaving it null. */
export function InventoryItemModal({ open, item, onClose }: InventoryItemModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={item ? 'Edit inventory item' : 'Add inventory item'}
      footer={null}
      destroyOnHidden
    >
      {/* Key forces a fresh mount whenever the target changes so the form
       * state initializes from the new `item` without a sync effect. */}
      <ModalBody key={item?.id ?? 'new'} item={item} onDone={onClose} onCancel={onClose} />
    </Modal>
  );
}

interface ModalBodyProps {
  item: InventoryItem | null;
  onDone: () => void;
  onCancel: () => void;
}

function ModalBody({ item, onDone, onCancel }: ModalBodyProps) {
  const { message } = App.useApp();
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [imageUrl, setImageUrl] = useState<string | undefined>(item?.imageUrl);
  const [imageMimeType, setImageMimeType] = useState<InventoryImageMimeType | undefined>(
    item?.imageMimeType,
  );
  const [uploading, setUploading] = useState(false);

  const [createItem, { isLoading: isCreating }] = useCreateInventoryItemMutation();
  const [updateItem, { isLoading: isUpdating }] = useUpdateInventoryItemMutation();
  const [deleteItem, { isLoading: isDeleting }] = useDeleteInventoryItemMutation();

  const handleBeforeUpload: NonNullable<UploadProps['beforeUpload']> = async (file) => {
    if (!isInventoryImageMimeType(file.type)) {
      message.error('Please choose a PNG, JPEG, WEBP or GIF image');
      return Upload.LIST_IGNORE;
    }
    if (file.size > INVENTORY_IMAGE_MAX_BYTES) {
      const mb = (INVENTORY_IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(0);
      message.error(`Please choose an image under ${mb} MB`);
      return Upload.LIST_IGNORE;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageUrl(dataUrl);
      setImageMimeType(file.type as InventoryImageMimeType);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not read the image'));
    } finally {
      setUploading(false);
    }
    return false;
  };

  const trimmedTitle = title.trim();
  const busy = isCreating || isUpdating || uploading;
  const canSave = trimmedTitle.length > 0 && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    const payload = {
      title: trimmedTitle,
      description: description.trim() === '' ? undefined : description.trim(),
      imageUrl,
      imageMimeType,
    };
    try {
      if (item) {
        /* Only send what changed — the parent already knows the current shape,
         * and PATCH lets us clear the image by explicitly sending null. */
        await updateItem({
          itemId: item.id,
          title: payload.title,
          description: payload.description ?? '',
          imageUrl: payload.imageUrl ?? null,
          imageMimeType: payload.imageMimeType ?? null,
        }).unwrap();
        message.success('Inventory item updated');
      } else {
        await createItem(payload).unwrap();
        message.success('Inventory item added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the item'));
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    try {
      await deleteItem(item.id).unwrap();
      message.success('Inventory item deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the item'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {imageUrl ? (
        <div className="relative overflow-hidden rounded-lg border border-line bg-fill">
          <div className="relative w-full" style={{ paddingTop: '56%' }}>
            <NextImage
              src={imageUrl}
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
            onClick={() => {
              setImageUrl(undefined);
              setImageMimeType(undefined);
            }}
            icon={<X size={14} />}
            className="!absolute top-2 right-2 !bg-canvas/90"
          />
        </div>
      ) : (
        <Upload.Dragger
          accept={ACCEPT}
          multiple={false}
          beforeUpload={handleBeforeUpload}
          showUploadList={false}
          disabled={uploading}
        >
          <p className="mb-2 flex justify-center text-ink-soft">
            <CloudArrowUp size={28} weight="regular" />
          </p>
          <p className="text-sm font-medium text-ink">Add a photo (optional)</p>
          <p className="mt-1 text-xs text-ink-muted">
            PNG, JPEG, WEBP or GIF · up to {(INVENTORY_IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(0)}{' '}
            MB
          </p>
        </Upload.Dragger>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="inventory-title" className="text-sm font-medium text-ink">
          Title
        </label>
        <Input
          id="inventory-title"
          placeholder="What is this?"
          value={title}
          maxLength={INVENTORY_TITLE_MAX}
          showCount
          prefix={<ImageIcon size={14} className="text-ink-muted" />}
          onChange={(event) => setTitle(event.target.value)}
          onPressEnter={handleSave}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="inventory-description" className="text-sm font-medium text-ink">
          Description
        </label>
        <Input.TextArea
          id="inventory-description"
          placeholder="Where it lives, condition, any quirks."
          value={description}
          maxLength={INVENTORY_DESCRIPTION_MAX}
          showCount
          autoSize={{ minRows: 3, maxRows: 6 }}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {item ? (
          <Popconfirm
            title="Delete this item?"
            description="This cannot be undone."
            okText="Delete"
            okButtonProps={{ danger: true, loading: isDeleting }}
            cancelText="Cancel"
            onConfirm={handleDelete}
          >
            <Button danger disabled={busy || isDeleting}>
              Delete
            </Button>
          </Popconfirm>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            type="primary"
            disabled={!canSave}
            loading={isCreating || isUpdating}
            onClick={handleSave}
          >
            {item ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}
