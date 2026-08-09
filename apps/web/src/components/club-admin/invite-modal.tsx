'use client';

import { CheckCircle, Copy, Link as LinkIcon } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Modal, QRCode, Select } from 'antd';
import { useMemo, useState } from 'react';

import type { Invite } from '@/lib/club-admin/invites';
import type { OfficerRole } from '@/lib/education/members';
import { OFFICER_ROLES } from '@/lib/education/members';
import { useCreateInviteMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const ROLE_OPTIONS = OFFICER_ROLES.map((role) => ({ value: role, label: role }));

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

/** Generates a role-scoped join link — `/invite/:token` — instead of
 * addressing an invite to a specific email. Whoever opens the link signs in
 * or signs up, then lands on an accept page that hands them a Membership
 * with exactly the role(s) picked here. The link keeps working (and stays
 * re-copyable from the pending-invites list) until it's accepted, revoked,
 * or its 30-day expiry passes. */
export function InviteModal({ open, onClose }: InviteModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title="Invite a member" footer={null} destroyOnHidden>
      <ModalBody key={open ? 'open' : 'closed'} onCancel={onClose} onDone={onClose} />
    </Modal>
  );
}

function ModalBody({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [roles, setRoles] = useState<OfficerRole[]>(['Member']);
  const [created, setCreated] = useState<Invite | null>(null);

  const [createInvite, { isLoading: isSubmitting }] = useCreateInviteMutation();
  const { message } = App.useApp();

  const canSave = roles.length > 0 && !isSubmitting;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      const invite = await createInvite({ roles }).unwrap();
      setCreated(invite);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not create this invite'));
    }
  };

  if (created) {
    return <InviteLinkResult invite={created} onDone={onDone} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-roles" className="text-sm font-medium text-ink">
          Role(s)
        </label>
        <Select
          id="invite-roles"
          mode="multiple"
          className="w-full"
          placeholder="Pick at least one role"
          value={roles}
          onChange={(value: OfficerRole[]) => setRoles(value)}
          options={ROLE_OPTIONS}
        />
        <p className="text-xs text-ink-muted">
          Anyone who opens the link and joins gets these role(s) automatically.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" disabled={!canSave} loading={isSubmitting} onClick={handleSave}>
          Generate link
        </Button>
      </div>
    </div>
  );
}

function InviteLinkResult({ invite, onDone }: { invite: Invite; onDone: () => void }) {
  const { message } = App.useApp();

  const origin = useMemo(
    () => (typeof window !== 'undefined' && window.location ? window.location.origin : ''),
    [],
  );
  const inviteUrl = `${origin}/invite/${invite.token}`;
  const expiresOn = new Date(invite.expiresAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      message.success('Link copied');
    } catch {
      message.error('Could not copy — select the text manually');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-emerald-800">
        <CheckCircle size={18} weight="fill" />
        <p className="text-sm font-medium">
          Invite created — {invite.roles.join(', ') || 'Member'}
        </p>
      </div>

      <p className="text-xs text-ink-muted">
        Share this link however works best — send it directly or let them scan the QR code. It works
        once and expires on {expiresOn}. You can copy it again later from the pending invites list
        until then.
      </p>

      <div className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center justify-center rounded-md bg-canvas p-1.5">
          <QRCode value={inviteUrl} size={104} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-xs font-medium text-ink">Join link</p>
          <p className="truncate text-xs text-ink-muted" title={inviteUrl}>
            {inviteUrl}
          </p>
          <Button size="small" icon={<LinkIcon size={13} />} onClick={handleCopyLink}>
            Copy link
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button icon={<Copy size={14} />} onClick={handleCopyLink}>
          Copy link
        </Button>
        <Button type="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
