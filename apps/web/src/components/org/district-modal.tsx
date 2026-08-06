'use client';

import { App, Button, Input, Modal, Popconfirm } from 'antd';
import { useState } from 'react';
import type { District } from '@/lib/org/types';
import { DISTRICT_CODE_MAX, ORG_NAME_MAX } from '@/lib/org/types';
import {
  useCreateDistrictMutation,
  useDeleteDistrictMutation,
  useUpdateDistrictMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface DistrictModalProps {
  open: boolean;
  /** When present, the modal edits (and can delete) this district; when
   * null, it creates a new one. Only the Super Admin dashboard reaches this
   * modal — every other scope manages divisions downward, not districts. */
  district: District | null;
  onClose: () => void;
}

export function DistrictModal({ open, district, onClose }: DistrictModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={district ? `Edit ${district.name}` : 'Add district'}
      footer={null}
      destroyOnHidden
    >
      <ModalBody
        key={district?.id ?? 'new'}
        district={district}
        onDone={onClose}
        onCancel={onClose}
      />
    </Modal>
  );
}

interface ModalBodyProps {
  district: District | null;
  onDone: () => void;
  onCancel: () => void;
}

function ModalBody({ district, onDone, onCancel }: ModalBodyProps) {
  const { message } = App.useApp();
  const [name, setName] = useState(district?.name ?? '');
  const [code, setCode] = useState(district?.code ?? '');

  const [createDistrict, { isLoading: isCreating }] = useCreateDistrictMutation();
  const [updateDistrict, { isLoading: isUpdating }] = useUpdateDistrictMutation();
  const [deleteDistrict, { isLoading: isDeleting }] = useDeleteDistrictMutation();

  const busy = isCreating || isUpdating;
  const canSave = name.trim() !== '' && code.trim() !== '' && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      if (district) {
        await updateDistrict({
          districtId: district.id,
          name: name.trim(),
          code: code.trim(),
        }).unwrap();
        message.success('District updated');
      } else {
        await createDistrict({ name: name.trim(), code: code.trim() }).unwrap();
        message.success('District added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the district'));
    }
  };

  const handleDelete = async () => {
    if (!district) return;
    try {
      await deleteDistrict(district.id).unwrap();
      message.success('District deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the district'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="district-name" className="text-sm font-medium text-ink">
          Name
        </label>
        <Input
          id="district-name"
          placeholder="District 88"
          value={name}
          maxLength={ORG_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="district-code" className="text-sm font-medium text-ink">
          Code
        </label>
        <Input
          id="district-code"
          placeholder="D88"
          value={code}
          maxLength={DISTRICT_CODE_MAX}
          onChange={(event) => setCode(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {district ? (
          <Popconfirm
            title="Delete this district?"
            description="Every division, area and club under it is deleted too. This cannot be undone."
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
            {district ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}
