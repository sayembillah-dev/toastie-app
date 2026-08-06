'use client';

import { App, Button, Input, Modal, Popconfirm, Select } from 'antd';
import { useState } from 'react';
import type { OrgClub, OrgClubStatus } from '@/lib/org/types';
import {
  CLUB_NUMBER_MAX,
  ORG_CLUB_STATUS_LABELS,
  ORG_CLUB_STATUSES,
  ORG_NAME_MAX,
} from '@/lib/org/types';
import {
  useCreateOrgClubMutation,
  useDeleteOrgClubMutation,
  useUpdateOrgClubMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const STATUS_OPTIONS = ORG_CLUB_STATUSES.map((status) => ({
  value: status,
  label: ORG_CLUB_STATUS_LABELS[status],
}));

interface OrgClubModalProps {
  open: boolean;
  /** Parent to create the new club under; ignored in edit mode. */
  areaId: string;
  /** When present, the modal edits (and, if `canDelete`, deletes) this club;
   * when null, it creates a new one. */
  club: OrgClub | null;
  /** Only Super Admin can delete — Area/Division/District can create/rename
   * clubs in the directory but not remove them. */
  canDelete: boolean;
  onClose: () => void;
}

export function OrgClubModal({ open, areaId, club, canDelete, onClose }: OrgClubModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={club ? `Edit ${club.name}` : 'Add club'}
      footer={null}
      destroyOnHidden
    >
      <ModalBody
        key={club?.id ?? 'new'}
        areaId={areaId}
        club={club}
        canDelete={canDelete}
        onDone={onClose}
        onCancel={onClose}
      />
    </Modal>
  );
}

interface ModalBodyProps {
  areaId: string;
  club: OrgClub | null;
  canDelete: boolean;
  onDone: () => void;
  onCancel: () => void;
}

function ModalBody({ areaId, club, canDelete, onDone, onCancel }: ModalBodyProps) {
  const { message } = App.useApp();
  const [name, setName] = useState(club?.name ?? '');
  const [clubNumber, setClubNumber] = useState(club?.clubNumber ?? '');
  const [status, setStatus] = useState<OrgClubStatus>(club?.status ?? 'active');

  const [createClub, { isLoading: isCreating }] = useCreateOrgClubMutation();
  const [updateClub, { isLoading: isUpdating }] = useUpdateOrgClubMutation();
  const [deleteClub, { isLoading: isDeleting }] = useDeleteOrgClubMutation();

  const busy = isCreating || isUpdating;
  const canSave = name.trim() !== '' && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      if (club) {
        await updateClub({
          clubId: club.id,
          name: name.trim(),
          clubNumber: clubNumber.trim() === '' ? null : clubNumber.trim(),
          status,
        }).unwrap();
        message.success('Club updated');
      } else {
        await createClub({
          areaId,
          name: name.trim(),
          clubNumber: clubNumber.trim() === '' ? undefined : clubNumber.trim(),
          status,
        }).unwrap();
        message.success('Club added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the club'));
    }
  };

  const handleDelete = async () => {
    if (!club) return;
    try {
      await deleteClub(club.id).unwrap();
      message.success('Club deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the club'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="club-name" className="text-sm font-medium text-ink">
          Name
        </label>
        <Input
          id="club-name"
          placeholder="Sunrise Toastmasters"
          value={name}
          maxLength={ORG_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="club-number" className="text-sm font-medium text-ink">
          Club number (optional)
        </label>
        <Input
          id="club-number"
          placeholder="1002345"
          value={clubNumber}
          maxLength={CLUB_NUMBER_MAX}
          onChange={(event) => setClubNumber(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="club-status" className="text-sm font-medium text-ink">
          Status
        </label>
        <Select
          id="club-status"
          className="w-full"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {club && canDelete ? (
          <Popconfirm
            title="Delete this club?"
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
          <Button type="primary" disabled={!canSave} loading={busy} onClick={handleSave}>
            {club ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}
