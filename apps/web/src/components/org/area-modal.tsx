'use client';

import { App, Button, Form, Input, Modal, Popconfirm } from 'antd';
import { ReadOnly } from '@/components/permissions/read-only';
import type { Area } from '@/lib/org/types';
import { ORG_NAME_MAX } from '@/lib/org/types';
import { textFieldRules } from '@/lib/validation/rules';
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

interface FormValues {
  name: string;
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
  const [form] = Form.useForm<FormValues>();

  const [createArea, { isLoading: isCreating }] = useCreateAreaMutation();
  const [updateArea, { isLoading: isUpdating }] = useUpdateAreaMutation();
  const [deleteArea, { isLoading: isDeleting }] = useDeleteAreaMutation();

  const busy = isCreating || isUpdating;

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      if (area) {
        await updateArea({ areaId: area.id, name: values.name.trim() }).unwrap();
        message.success('Area updated');
      } else {
        await createArea({ divisionId, name: values.name.trim() }).unwrap();
        message.success('Area added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't save the area. Please try again."));
    }
  }

  async function handleDelete() {
    if (!area) return;
    try {
      await deleteArea(area.id).unwrap();
      message.success('Area deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't delete the area. Please try again."));
    }
  }

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      disabled={busy}
      initialValues={{ name: area?.name ?? '' }}
      className="flex flex-col gap-4"
    >
      <Form.Item
        label="Name"
        name="name"
        rules={textFieldRules({ label: 'Name', max: ORG_NAME_MAX })}
        className="!mb-0"
      >
        <Input id="area-name" placeholder="Area A1" maxLength={ORG_NAME_MAX} />
      </Form.Item>

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
          <ReadOnly resource="orgUnit" action={area ? 'update' : 'create'}>
            <Button type="primary" loading={busy} onClick={handleSave}>
              {area ? 'Save' : 'Add'}
            </Button>
          </ReadOnly>
        </div>
      </div>
    </Form>
  );
}
