'use client';

import { App, Button, Input, Modal, Select } from 'antd';
import { useState } from 'react';

import type { Member, OfficerRole } from '@/lib/education/members';
import { OFFICER_ROLES } from '@/lib/education/members';
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
  const [firstName, setFirstName] = useState(member?.firstName ?? '');
  const [lastName, setLastName] = useState(member?.lastName ?? '');
  const [roles, setRoles] = useState<OfficerRole[]>(member?.roles ?? ['Member']);

  const [createMember, { isLoading: isCreating }] = useCreateMemberMutation();
  const [updateMember, { isLoading: isUpdating }] = useUpdateMemberMutation();

  const busy = isCreating || isUpdating;
  const canSave = firstName.trim() !== '' && lastName.trim() !== '' && roles.length > 0 && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      if (member) {
        await updateMember({
          memberId: member.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          roles,
        }).unwrap();
        message.success('Member updated');
      } else {
        await createMember({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          roles,
        }).unwrap();
        message.success('Member added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save this member'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="member-first-name" className="text-sm font-medium text-ink">
          First name
        </label>
        <Input
          id="member-first-name"
          placeholder="Aisha"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="member-last-name" className="text-sm font-medium text-ink">
          Last name
        </label>
        <Input
          id="member-last-name"
          placeholder="Patel"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="member-roles" className="text-sm font-medium text-ink">
          Roles
        </label>
        <Select
          id="member-roles"
          mode="multiple"
          className="w-full"
          placeholder="Select one or more roles"
          value={roles}
          onChange={(value: OfficerRole[]) => setRoles(value)}
          options={ROLE_OPTIONS}
        />
        <p className="text-[11px] text-ink-muted">A member can hold more than one officer role.</p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" disabled={!canSave} loading={busy} onClick={handleSave}>
          {member ? 'Save' : 'Add'}
        </Button>
      </div>
    </div>
  );
}
