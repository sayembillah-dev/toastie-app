'use client';

import { App, Button, Form, Input, Modal, Popconfirm } from 'antd';
import type { Division } from '@/lib/org/types';
import { ORG_NAME_MAX } from '@/lib/org/types';
import { textFieldRules } from '@/lib/validation/rules';
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

interface FormValues {
  name: string;
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
  const [form] = Form.useForm<FormValues>();

  const [createDivision, { isLoading: isCreating }] = useCreateDivisionMutation();
  const [updateDivision, { isLoading: isUpdating }] = useUpdateDivisionMutation();
  const [deleteDivision, { isLoading: isDeleting }] = useDeleteDivisionMutation();

  const busy = isCreating || isUpdating;

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      if (division) {
        await updateDivision({ divisionId: division.id, name: values.name.trim() }).unwrap();
        message.success('Division updated');
      } else {
        await createDivision({ districtId, name: values.name.trim() }).unwrap();
        message.success('Division added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't save the division. Please try again."));
    }
  }

  async function handleDelete() {
    if (!division) return;
    try {
      await deleteDivision(division.id).unwrap();
      message.success('Division deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't delete the division. Please try again."));
    }
  }

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      disabled={busy}
      initialValues={{ name: division?.name ?? '' }}
      className="flex flex-col gap-4"
    >
      <Form.Item
        label="Name"
        name="name"
        rules={textFieldRules({ label: 'Name', max: ORG_NAME_MAX })}
        className="!mb-0"
      >
        <Input id="division-name" placeholder="Division A" maxLength={ORG_NAME_MAX} />
      </Form.Item>

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
          <Button type="primary" loading={busy} onClick={handleSave}>
            {division ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </Form>
  );
}
