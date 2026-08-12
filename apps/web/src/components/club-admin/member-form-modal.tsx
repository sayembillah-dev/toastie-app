'use client';

import { App, Button, Form, Input, Modal, Select } from 'antd';

import { ReadOnly } from '@/components/permissions/read-only';
import type { Member, OfficerRole } from '@/lib/education/members';
import { OFFICER_ROLES } from '@/lib/education/members';
import { NAME_MAX, requiredSelectRule, shortNameRules } from '@/lib/validation/rules';
import { useCreateMemberMutation, useUpdateMemberMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const ROLE_OPTIONS = OFFICER_ROLES.map((role) => ({ value: role, label: role }));

interface MemberFormModalProps {
  open: boolean;
  /** When present, the modal edits this member's name and roles; when null,
   * it creates a new one. Removal, Club Admin rights and permissions each
   * have their own dedicated action on the roster row. */
  member: Member | null;
  onClose: () => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  roles: OfficerRole[];
}

export function MemberFormModal({ open, member, onClose }: MemberFormModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={member ? `Edit ${member.firstName} ${member.lastName}` : 'Add member'}
      footer={null}
      destroyOnHidden
    >
      <ModalBody key={member?.id ?? 'new'} member={member} onDone={onClose} onCancel={onClose} />
    </Modal>
  );
}

interface ModalBodyProps {
  member: Member | null;
  onDone: () => void;
  onCancel: () => void;
}

function ModalBody({ member, onDone, onCancel }: ModalBodyProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();

  const [createMember, { isLoading: isCreating }] = useCreateMemberMutation();
  const [updateMember, { isLoading: isUpdating }] = useUpdateMemberMutation();

  const busy = isCreating || isUpdating;

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      if (member) {
        await updateMember({
          memberId: member.id,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          roles: values.roles,
        }).unwrap();
        message.success('Member updated');
      } else {
        await createMember({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          roles: values.roles,
        }).unwrap();
        message.success('Member added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't save this member. Please try again."));
    }
  }

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      disabled={busy}
      initialValues={{
        firstName: member?.firstName ?? '',
        lastName: member?.lastName ?? '',
        roles: member?.roles ?? ['Member'],
      }}
      className="flex flex-col gap-4"
    >
      <Form.Item
        label="First name"
        name="firstName"
        rules={shortNameRules('First name')}
        className="!mb-0"
      >
        <Input id="member-first-name" placeholder="Aisha" maxLength={NAME_MAX} />
      </Form.Item>

      <Form.Item
        label="Last name"
        name="lastName"
        rules={shortNameRules('Last name')}
        className="!mb-0"
      >
        <Input id="member-last-name" placeholder="Patel" maxLength={NAME_MAX} />
      </Form.Item>

      <Form.Item
        label="Roles"
        name="roles"
        rules={[requiredSelectRule('Role')]}
        extra="A member can hold more than one officer role."
        className="!mb-0"
      >
        <Select
          id="member-roles"
          mode="multiple"
          className="w-full"
          placeholder="Select one or more roles"
          options={ROLE_OPTIONS}
        />
      </Form.Item>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <ReadOnly resource="member" action={member ? 'update' : 'create'}>
          <Button type="primary" loading={busy} onClick={handleSave}>
            {member ? 'Save' : 'Add'}
          </Button>
        </ReadOnly>
      </div>
    </Form>
  );
}
