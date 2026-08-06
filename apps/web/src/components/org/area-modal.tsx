'use client';

import { App, Button, Input, Modal, Popconfirm } from 'antd';
import { useState } from 'react';
import type { Area } from '@/lib/org/types';
import { ORG_NAME_MAX } from '@/lib/org/types';
import { useCreateAreaMutation, useDeleteAreaMutation, useUpdateAreaMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface AreaModalProps {
  open: boolean;
  /** Parent to create the new area under; ignored in edit mode. */
  divisionId: string;
  /** When present, the modal edits (and, if `canDelete`, deletes) this area;
   * when null, it creates a new one. */
  area: Area | null;
  /** Only Super Admin can delete — District/Division can create/rename their
   * areas but not remove them. */
  canDelete: boolean;
  onClose: () => void;
}

export function AreaModal({ open, divisionId, area, canDelete, onClose }: AreaModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={area ? `Edit ${area.name}` : 'Add area'}
      footer={null}
      destroyOnHidden
    >
      <ModalBody
        key={area?.id ?? 'new'}
        divisionId={divisionId}
        area={area}
        canDelete={canDelete}
        onDone={onClose}
        onCancel={onClose}
      />
    </Modal>
  );
}

interface ModalBodyProps {
  divisionId: string;
  area: Area | null;
  canDelete: boolean;
  onDone: () => void;
  onCancel: () => void;
}

function ModalBody({ divisionId, area, canDelete, onDone, onCancel }: ModalBodyProps) {
  const { message } = App.useApp();
  const [name, setName] = useState(area?.name ?? '');

  const [createArea, { isLoading: isCreating }] = useCreateAreaMutation();
  const [updateArea, { isLoading: isUpdating }] = useUpdateAreaMutation();
  const [deleteArea, { isLoading: isDeleting }] = useDeleteAreaMutation();

  const busy = isCreating || isUpdating;
  const canSave = name.trim() !== '' && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      if (area) {
        await updateArea({ areaId: area.id, name: name.trim() }).unwrap();
        message.success('Area updated');
      } else {
        await createArea({ divisionId, name: name.trim() }).unwrap();
        message.success('Area added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the area'));
    }
  };

  const handleDelete = async () => {
    if (!area) return;
    try {
      await deleteArea(area.id).unwrap();
      message.success('Area deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the area'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="area-name" className="text-sm font-medium text-ink">
          Name
        </label>
        <Input
          id="area-name"
          placeholder="Area A1"
          value={name}
          maxLength={ORG_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {area && canDelete ? (
          <Popconfirm
            title="Delete this area?"
            description="Every club under it is deleted too. This cannot be undone."
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
          <Button type="primary" disabled={!canSave} loading={busy} onClick={handleSave}>
            {area ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}
