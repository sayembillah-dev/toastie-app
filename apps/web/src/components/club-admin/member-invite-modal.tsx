'use client';

import { PaperPlaneTilt } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Modal, Tag } from 'antd';
import { useState } from 'react';

import { InviteLinkResult } from '@/components/club-admin/invite-modal';
import { ReadOnly } from '@/components/permissions/read-only';
import type { Invite } from '@/lib/club-admin/invites';
import type { Member, OfficerRole } from '@/lib/education/members';
import { useCreateInviteMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface MemberInviteModalProps {
  /** The unclaimed roster row to invite; `null` closes the modal. */
  member: Member | null;
  onClose: () => void;
}

/** Generates a join link targeted at one specific roster row — the per-member
 * counterpart of the generic "Invite member" link. When the person opens the
 * link and signs in (or signs up), they claim *this* record: every meeting
 * role, attendance entry, pathway step and evaluation already tracked under
 * their name stays exactly where it is and simply becomes theirs. */
export function MemberInviteModal({ member, onClose }: MemberInviteModalProps) {
  return (
    <Modal
      open={member !== null}
      onCancel={onClose}
      title={member ? `Invite ${member.firstName} ${member.lastName}` : 'Invite member'}
      footer={null}
      destroyOnHidden
    >
      {member ? (
        <ModalBody key={member.id} member={member} onDone={onClose} onCancel={onClose} />
      ) : null}
    </Modal>
  );
}

interface ModalBodyProps {
  member: Member;
  onDone: () => void;
  onCancel: () => void;
}

function ModalBody({ member, onDone, onCancel }: ModalBodyProps) {
  const { message } = App.useApp();
  const [created, setCreated] = useState<Invite | null>(null);
  const [createInvite, { isLoading }] = useCreateInviteMutation();

  const fullName = `${member.firstName} ${member.lastName}`;
  // The invite's roles are stamped onto the roster row at accept time, so
  // they mirror whatever the member currently holds — a plain member has an
  // empty list, which the invite DTO rejects, hence the explicit fallback.
  const roles: OfficerRole[] = member.roles.length > 0 ? member.roles : ['Member'];

  async function handleGenerate() {
    try {
      const invite = await createInvite({
        inviteeName: fullName,
        roles,
        membershipId: member.id,
      }).unwrap();
      setCreated(invite);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't create this invite. Please try again."));
    }
  }

  if (created) {
    return <InviteLinkResult invite={created} onDone={onDone} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">
        This creates a personal join link for <strong className="text-ink">{fullName}</strong>.
        Everything already recorded under their name — meeting roles, attendance, pathway progress,
        evaluations — becomes theirs the moment they accept, and they set their own password during
        sign-up.
      </p>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Role(s) on join</span>
        <p className="flex flex-wrap items-center gap-1">
          {roles.map((role) => (
            <Tag key={role} className="m-0">
              {role}
            </Tag>
          ))}
        </p>
        <p className="text-xs text-ink-muted">
          Mirrors their current roster roles — change roles from Edit member first if needed.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <ReadOnly resource="invite" action="create">
          <Button
            type="primary"
            icon={<PaperPlaneTilt size={14} />}
            loading={isLoading}
            onClick={handleGenerate}
          >
            Generate invite link
          </Button>
        </ReadOnly>
      </div>
    </div>
  );
}
