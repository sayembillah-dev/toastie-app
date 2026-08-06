'use client';

import { App, Button, Input, Modal, Select } from 'antd';
import { useState } from 'react';

import type { OfficerRole } from '@/lib/education/members';
import { OFFICER_ROLES } from '@/lib/education/members';
import { useCreateInviteMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const ROLE_OPTIONS = OFFICER_ROLES.map((role) => ({ value: role, label: role }));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

/** No email is actually sent — there's no email infrastructure in this app
 * and no sign-up flow for the invitee to accept from. This just records a
 * pending invite the admin tracks and later converts by hand once the
 * person actually joins (see the "Pending invites" list). */
export function InviteModal({ open, onClose }: InviteModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title="Invite a member" footer={null} destroyOnHidden>
      <ModalBody key={open ? 'open' : 'closed'} onDone={onClose} onCancel={onClose} />
    </Modal>
  );
}

function ModalBody({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { message } = App.useApp();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roles, setRoles] = useState<OfficerRole[]>([]);

  const [createInvite, { isLoading: isSubmitting }] = useCreateInviteMutation();

  const canSave = EMAIL_PATTERN.test(email.trim()) && !isSubmitting;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await createInvite({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        roles,
      }).unwrap();
      message.success(`Invited ${email.trim()}`);
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not send this invite'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-email" className="text-sm font-medium text-ink">
          Email
        </label>
        <Input
          id="invite-email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-first-name" className="text-sm font-medium text-ink">
            First name (optional)
          </label>
          <Input
            id="invite-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-last-name" className="text-sm font-medium text-ink">
            Last name (optional)
          </label>
          <Input
            id="invite-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-roles" className="text-sm font-medium text-ink">
          Roles (optional)
        </label>
        <Select
          id="invite-roles"
          mode="multiple"
          className="w-full"
          placeholder="Defaults to plain Member"
          value={roles}
          onChange={(value: OfficerRole[]) => setRoles(value)}
          options={ROLE_OPTIONS}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" disabled={!canSave} loading={isSubmitting} onClick={handleSave}>
          Send invite
        </Button>
      </div>
    </div>
  );
}
