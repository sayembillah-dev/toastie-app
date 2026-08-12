'use client';

import { Info, UserCircle, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { skipToken } from '@reduxjs/toolkit/query';
import { App, Button, Modal, Select } from 'antd';
import { useMemo, useState } from 'react';

import { InviteLinkResult } from '@/components/club-admin/invite-modal';
import { ReadOnly } from '@/components/permissions/read-only';
import type { OfficerRole } from '@/lib/education/members';
import { OFFICER_ROLES } from '@/lib/education/members';
import type { ConvertGuestResult } from '@/lib/people/guests';
import { getGuestFullName } from '@/lib/people/guests';
import {
  useCheckGuestMatchQuery,
  useConvertGuestToMemberMutation,
  useGetGuestsQuery,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const ROLE_OPTIONS = OFFICER_ROLES.map((role) => ({ value: role, label: role }));

interface ConvertGuestModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selects (and locks) the guest, for launching this from a specific
   * guest's own actions rather than picking one out of the full list. */
  guestId?: string;
}

/** Turns a guest already in the pipeline into a full member — the guest
 * record stays put (moved to the `joined-club` Kanban column, not deleted)
 * so their visit/contact history is never lost. */
export function ConvertGuestModal({ open, onClose, guestId }: ConvertGuestModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title="Add from guests" footer={null} destroyOnHidden>
      <ModalBody
        key={open ? 'open' : 'closed'}
        onDone={onClose}
        onCancel={onClose}
        fixedGuestId={guestId}
      />
    </Modal>
  );
}

function ModalBody({
  onDone,
  onCancel,
  fixedGuestId,
}: {
  onDone: () => void;
  onCancel: () => void;
  fixedGuestId?: string;
}) {
  const { message } = App.useApp();
  const { data: guests } = useGetGuestsQuery();
  const [guestId, setGuestId] = useState<string | null>(fixedGuestId ?? null);
  const [roles, setRoles] = useState<OfficerRole[]>([]);
  const [result, setResult] = useState<ConvertGuestResult | null>(null);

  const { data: match, isFetching: isCheckingMatch } = useCheckGuestMatchQuery(
    guestId ?? skipToken,
  );
  const [convertGuest, { isLoading: isSubmitting }] = useConvertGuestToMemberMutation();

  const guestOptions = useMemo(
    () =>
      (guests ?? [])
        .filter((guest) => guest.stage !== 'joined-club')
        .map((guest) => ({
          value: guest.id,
          label: getGuestFullName(guest),
        })),
    [guests],
  );

  const fixedGuest = fixedGuestId
    ? (guests ?? []).find((guest) => guest.id === fixedGuestId)
    : undefined;

  const isAlreadyMember = match?.status === 'already-member';
  const canSave = guestId !== null && !isSubmitting && !isCheckingMatch && !isAlreadyMember;

  const handleSave = async () => {
    if (!guestId) return;
    try {
      const converted = await convertGuest({
        guestId,
        roles: roles.length > 0 ? roles : undefined,
      }).unwrap();
      if (converted.outcome === 'unclaimed' && converted.invite) {
        setResult(converted);
        return;
      }
      message.success(
        `${converted.membership.firstName} ${converted.membership.lastName} joined as a member — they can log in now`,
      );
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not convert this guest'));
    }
  };

  if (result?.invite) {
    return <InviteLinkResult invite={result.invite} onDone={onDone} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {fixedGuestId ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Guest</span>
          <p className="text-sm text-ink-soft">
            {fixedGuest ? getGuestFullName(fixedGuest) : 'Loading…'}
          </p>
        </div>
      ) : (
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
      )}

      {match?.status === 'existing-user' && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-blue-800">
          <UserCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
          <p className="text-sm">
            Matches an existing account —{' '}
            <strong>
              {match.user.firstName} {match.user.lastName}
            </strong>{' '}
            ({match.user.phoneMasked}). They already have portal access, so no invite is needed —
            they&apos;ll see this club next time they log in.
          </p>
        </div>
      )}

      {match?.status === 'already-member' && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-amber-800">
          <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
          <p className="text-sm">
            This guest&apos;s phone matches an account that&apos;s already a member of this club
            {match.membership.status === 'removed' ? ' (currently inactive)' : ''}. Manage their
            membership from the roster instead of converting again.
          </p>
        </div>
      )}

      {match?.status === 'no-match' && guestId !== null && (
        <div className="flex items-start gap-2 rounded-lg bg-canvas px-3 py-2.5 text-ink-muted">
          <Info size={18} weight="fill" className="mt-0.5 shrink-0" />
          <p className="text-sm">
            No matching account found — converting will create a join link you can hand to them
            right away.
          </p>
        </div>
      )}

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
          disabled={isAlreadyMember}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <ReadOnly resource="member" action="create">
          <Button type="primary" disabled={!canSave} loading={isSubmitting} onClick={handleSave}>
            {match?.status === 'existing-user' ? 'Link as member' : 'Add as member'}
          </Button>
        </ReadOnly>
      </div>
    </div>
  );
}
