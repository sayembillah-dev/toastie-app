'use client';

import { App, Button, Modal, Select } from 'antd';
import { useMemo, useState } from 'react';

import type { OfficerRole } from '@/lib/education/members';
import { OFFICER_ROLES } from '@/lib/education/members';
import { useConvertGuestToMemberMutation, useGetGuestsQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const ROLE_OPTIONS = OFFICER_ROLES.map((role) => ({ value: role, label: role }));

interface ConvertGuestModalProps {
  open: boolean;
  onClose: () => void;
}

/** Turns a guest already in the pipeline into a full member — the guest
 * record stays put (moved to the `joined-club` Kanban column, not deleted)
 * so their visit/contact history is never lost. */
export function ConvertGuestModal({ open, onClose }: ConvertGuestModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title="Add from guests" footer={null} destroyOnHidden>
      <ModalBody key={open ? 'open' : 'closed'} onDone={onClose} onCancel={onClose} />
    </Modal>
  );
}

function ModalBody({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { message } = App.useApp();
  const { data: guests } = useGetGuestsQuery();
  const [guestId, setGuestId] = useState<string | null>(null);
  const [roles, setRoles] = useState<OfficerRole[]>([]);

  const [convertGuest, { isLoading: isSubmitting }] = useConvertGuestToMemberMutation();

  const guestOptions = useMemo(
    () =>
      (guests ?? [])
        .filter((guest) => guest.stage !== 'joined-club')
        .map((guest) => ({
          value: guest.id,
          label: `${guest.firstName} ${guest.lastName}`,
        })),
    [guests],
  );

  const canSave = guestId !== null && !isSubmitting;

  const handleSave = async () => {
    if (!guestId) return;
    try {
      const member = await convertGuest({
        guestId,
        roles: roles.length > 0 ? roles : undefined,
      }).unwrap();
      message.success(`${member.firstName} ${member.lastName} joined as a member`);
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not convert this guest'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="convert-guest" className="text-sm font-medium text-ink">
          Guest
        </label>
        <Select
          id="convert-guest"
          className="w-full"
          placeholder={guestOptions.length > 0 ? 'Select a guest' : 'No guests to convert'}
          value={guestId ?? undefined}
          onChange={setGuestId}
          options={guestOptions}
          showSearch
          optionFilterProp="label"
          disabled={guestOptions.length === 0}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="convert-guest-roles" className="text-sm font-medium text-ink">
          Roles (optional)
        </label>
        <Select
          id="convert-guest-roles"
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
          Add as member
        </Button>
      </div>
    </div>
  );
}
