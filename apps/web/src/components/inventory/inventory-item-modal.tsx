'use client';

import { CloudArrowUp, Image as ImageIcon, X } from '@phosphor-icons/react/dist/ssr';
import type { UploadProps } from 'antd';
import { App, Button, Input, Modal, Popconfirm, Upload } from 'antd';
import NextImage from 'next/image';
import { useEffect, useState } from 'react';

import { ReadOnly } from '@/components/permissions/read-only';
import type { InventoryImageMimeType, InventoryItem } from '@/lib/inventory/inventory-items';
import {
  INVENTORY_DESCRIPTION_MAX,
  INVENTORY_IMAGE_MAX_BYTES,
  INVENTORY_IMAGE_MIME_TYPES,
  INVENTORY_TITLE_MAX,
  isInventoryImageMimeType,
} from '@/lib/inventory/inventory-items';
import { uploadFile } from '@/lib/uploads';
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
  /* The photo is held as a `File` until save. What the API returns for an
   * existing item is a short-lived signed URL, and what it accepts is an
   * object key, so the value on screen and the value on the wire are
   * different strings — `pending`/`cleared` keep them apart. Leaving both
   * unset means "untouched", and the PATCH omits the image entirely. */
  const [pendingImage, setPendingImage] = useState<{
    file: File;
    previewUrl: string;
    mimeType: InventoryImageMimeType;
  } | null>(null);
  const [imageCleared, setImageCleared] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!pendingImage) return;
    return () => URL.revokeObjectURL(pendingImage.previewUrl);
  }, [pendingImage]);

  const shownImage = pendingImage?.previewUrl ?? (imageCleared ? undefined : item?.imageUrl);

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
    setPendingImage({
      file,
      previewUrl: URL.createObjectURL(file),
      mimeType: file.type as InventoryImageMimeType,
    });
    setImageCleared(false);
    return false;
  };

  const trimmedTitle = title.trim();
  const busy = isCreating || isUpdating || uploading;
  const canSave = trimmedTitle.length > 0 && !busy;

  const handleSave = async () => {
    if (!canSave) return;

    /* Upload before the row write so a rejected photo fails loudly instead of
     * saving an item that points at nothing. `null` clears the image; leaving
     * both fields off the payload means "don't touch it". */
    let image: { imageUrl: string | null; imageMimeType: InventoryImageMimeType | null } | null =
      null;
    setUploading(true);
    try {
      if (pendingImage) {
        image = {
          imageUrl: await uploadFile(pendingImage.file, 'inventory'),
          imageMimeType: pendingImage.mimeType,
        };
      } else if (imageCleared) {
        image = { imageUrl: null, imageMimeType: null };
      }
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not upload the image'));
      return;
    } finally {
      setUploading(false);
    }

    const description_ = description.trim();
    try {
      if (item) {
        await updateItem({
          itemId: item.id,
          title: trimmedTitle,
          description: description_,
          ...(image ?? {}),
        }).unwrap();
        message.success('Inventory item updated');
      } else {
        await createItem({
          title: trimmedTitle,
          description: description_ === '' ? undefined : description_,
          ...(image?.imageUrl
            ? { imageUrl: image.imageUrl, imageMimeType: image.imageMimeType ?? undefined }
            : {}),
        }).unwrap();
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

  /* The row already exists for a reader to look at, so the fields stay on
   * screen and go grey rather than being swapped for a read-only rendering.
   * Cancel is deliberately outside the fence — closing is not a write. */
  const writeAction = item ? 'update' : 'create';

  return (
    <div className="flex flex-col gap-4">
      <ReadOnly
        resource="inventory"
        action={writeAction}
        display="block"
        className="flex flex-col gap-4"
      >
        {shownImage ? (
          <div className="relative overflow-hidden rounded-lg border border-line bg-fill">
            <div className="relative w-full" style={{ paddingTop: '56%' }}>
              <NextImage
                src={shownImage}
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
                setPendingImage(null);
                setImageCleared(true);
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
              PNG, JPEG, WEBP or GIF · up to{' '}
              {(INVENTORY_IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB
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
      </ReadOnly>

      <div className="flex items-center justify-between gap-2">
        {item ? (
          <ReadOnly resource="inventory" action="delete">
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
          </ReadOnly>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <ReadOnly resource="inventory" action={writeAction}>
            <Button
              type="primary"
              disabled={!canSave}
              loading={isCreating || isUpdating}
              onClick={handleSave}
            >
              {item ? 'Save' : 'Add'}
            </Button>
          </ReadOnly>
        </div>
      </div>
    </div>
  );
}
