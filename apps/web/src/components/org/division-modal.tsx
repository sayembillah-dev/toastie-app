'use client';

import { App, Button, Input, Modal, Popconfirm } from 'antd';
import { useState } from 'react';
import type { Division } from '@/lib/org/types';
import { ORG_NAME_MAX } from '@/lib/org/types';
import {
  useCreateDivisionMutation,
  useDeleteDivisionMutation,
  useUpdateDivisionMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface DivisionModalProps {
  open: boolean;
  /** Parent to create the new division under; ignored in edit mode. */
  districtId: string;
  /** When present, the modal edits (and, if `canDelete`, deletes) this
   * division; when null, it creates a new one. */
  division: Division | null;
  /** Only Super Admin can delete — District can create/rename its own
   * divisions but not remove them. */
  canDelete: boolean;
  onClose: () => void;
}

export function DivisionModal({
  open,
  districtId,
  division,
  canDelete,
  onClose,
}: DivisionModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={division ? `Edit ${division.name}` : 'Add division'}
      footer={null}
      destroyOnHidden
    >
      <ModalBody
        key={division?.id ?? 'new'}
        districtId={districtId}
        division={division}
        canDelete={canDelete}
        onDone={onClose}
        onCancel={onClose}
      />
    </Modal>
  );
}

interface ModalBodyProps {
  districtId: string;
  division: Division | null;
  canDelete: boolean;
  onDone: () => void;
  onCancel: () => void;
}

function ModalBody({ districtId, division, canDelete, onDone, onCancel }: ModalBodyProps) {
  const { message } = App.useApp();
  const [name, setName] = useState(division?.name ?? '');

  const [createDivision, { isLoading: isCreating }] = useCreateDivisionMutation();
  const [updateDivision, { isLoading: isUpdating }] = useUpdateDivisionMutation();
  const [deleteDivision, { isLoading: isDeleting }] = useDeleteDivisionMutation();

  const busy = isCreating || isUpdating;
  const canSave = name.trim() !== '' && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      if (division) {
        await updateDivision({ divisionId: division.id, name: name.trim() }).unwrap();
        message.success('Division updated');
      } else {
        await createDivision({ districtId, name: name.trim() }).unwrap();
        message.success('Division added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the division'));
    }
  };

  const handleDelete = async () => {
    if (!division) return;
    try {
      await deleteDivision(division.id).unwrap();
      message.success('Division deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the division'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="division-name" className="text-sm font-medium text-ink">
          Name
        </label>
        <Input
          id="division-name"
          placeholder="Division A"
          value={name}
          maxLength={ORG_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {division && canDelete ? (
          <Popconfirm
            title="Delete this division?"
            description="Every area and club under it is deleted too. This cannot be undone."
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
            {division ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}
