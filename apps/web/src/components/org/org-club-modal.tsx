'use client';

import { App, Button, Form, Input, Modal, Popconfirm, Select } from 'antd';
import { ReadOnly } from '@/components/permissions/read-only';
import type { OrgClub, OrgClubStatus } from '@/lib/org/types';
import {
  CLUB_NUMBER_MAX,
  ORG_CLUB_STATUS_LABELS,
  ORG_CLUB_STATUSES,
  ORG_NAME_MAX,
} from '@/lib/org/types';
import { textFieldRules } from '@/lib/validation/rules';
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

interface FormValues {
  name: string;
  clubNumber: string;
  status: OrgClubStatus;
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
  const [form] = Form.useForm<FormValues>();

  const [createClub, { isLoading: isCreating }] = useCreateOrgClubMutation();
  const [updateClub, { isLoading: isUpdating }] = useUpdateOrgClubMutation();
  const [deleteClub, { isLoading: isDeleting }] = useDeleteOrgClubMutation();

  const busy = isCreating || isUpdating;

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const trimmedNumber = values.clubNumber.trim();
    try {
      if (club) {
        await updateClub({
          clubId: club.id,
          name: values.name.trim(),
          clubNumber: trimmedNumber === '' ? null : trimmedNumber,
          status: values.status,
        }).unwrap();
        message.success('Club updated');
      } else {
        await createClub({
          areaId,
          name: values.name.trim(),
          clubNumber: trimmedNumber === '' ? undefined : trimmedNumber,
          status: values.status,
        }).unwrap();
        message.success('Club added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't save the club. Please try again."));
    }
  }

  async function handleDelete() {
    if (!club) return;
    try {
      await deleteClub(club.id).unwrap();
      message.success('Club deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't delete the club. Please try again."));
    }
  }

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      disabled={busy}
      initialValues={{
        name: club?.name ?? '',
        clubNumber: club?.clubNumber ?? '',
        status: club?.status ?? 'active',
      }}
      className="flex flex-col gap-4"
    >
      <Form.Item
        label="Name"
        name="name"
        rules={textFieldRules({ label: 'Name', max: ORG_NAME_MAX })}
        className="!mb-0"
      >
        <Input id="club-name" placeholder="Sunrise Toastmasters" maxLength={ORG_NAME_MAX} />
      </Form.Item>

      <Form.Item
        label="Club number (optional)"
        name="clubNumber"
        rules={[{ max: CLUB_NUMBER_MAX, message: `Keep it under ${CLUB_NUMBER_MAX} characters` }]}
        className="!mb-0"
      >
        <Input id="club-number" placeholder="1002345" maxLength={CLUB_NUMBER_MAX} />
      </Form.Item>

      <Form.Item label="Status" name="status" className="!mb-0">
        <Select id="club-status" className="w-full" options={STATUS_OPTIONS} />
      </Form.Item>

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
          <ReadOnly resource="club" action={club ? 'update' : 'create'}>
            <Button type="primary" loading={busy} onClick={handleSave}>
              {club ? 'Save' : 'Add'}
            </Button>
          </ReadOnly>
        </div>
      </div>
    </Form>
  );
}
