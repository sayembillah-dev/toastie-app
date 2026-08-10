'use client';

import { App, Button, Form, Input, Modal, Popconfirm } from 'antd';
import type { District } from '@/lib/org/types';
import { DISTRICT_CODE_MAX, ORG_NAME_MAX } from '@/lib/org/types';
import { textFieldRules } from '@/lib/validation/rules';
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

interface FormValues {
  name: string;
  code: string;
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
  const [form] = Form.useForm<FormValues>();

  const [createDistrict, { isLoading: isCreating }] = useCreateDistrictMutation();
  const [updateDistrict, { isLoading: isUpdating }] = useUpdateDistrictMutation();
  const [deleteDistrict, { isLoading: isDeleting }] = useDeleteDistrictMutation();

  const busy = isCreating || isUpdating;

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      if (district) {
        await updateDistrict({
          districtId: district.id,
          name: values.name.trim(),
          code: values.code.trim(),
        }).unwrap();
        message.success('District updated');
      } else {
        await createDistrict({
          name: values.name.trim(),
          code: values.code.trim(),
        }).unwrap();
        message.success('District added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't save the district. Please try again."));
    }
  }

  async function handleDelete() {
    if (!district) return;
    try {
      await deleteDistrict(district.id).unwrap();
      message.success('District deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't delete the district. Please try again."));
    }
  }

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      disabled={busy}
      initialValues={{ name: district?.name ?? '', code: district?.code ?? '' }}
      className="flex flex-col gap-4"
    >
      <Form.Item
        label="Name"
        name="name"
        rules={textFieldRules({ label: 'Name', max: ORG_NAME_MAX })}
        className="!mb-0"
      >
        <Input id="district-name" placeholder="District 88" maxLength={ORG_NAME_MAX} />
      </Form.Item>

      <Form.Item
        label="Code"
        name="code"
        rules={textFieldRules({ label: 'Code', max: DISTRICT_CODE_MAX })}
        className="!mb-0"
      >
        <Input id="district-code" placeholder="D88" maxLength={DISTRICT_CODE_MAX} />
      </Form.Item>

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
          <Button type="primary" loading={busy} onClick={handleSave}>
            {district ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </Form>
  );
}
