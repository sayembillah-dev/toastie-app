'use client';

import { Link as LinkIcon, Plus } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Tag } from 'antd';
import { useMemo, useState } from 'react';

import { InviteModal } from '@/components/club-admin/invite-modal';
import { useCan } from '@/lib/permissions/use-can';
import { useGetInvitesQuery, useRevokeInviteMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** The "Invite member" button + its pending-invites list, self-contained so
 * it drops into any page without that page having to know about `invite`
 * permissions. Club Admin gets full read/create/delete; VP Membership gets
 * create+read only (see `VP_MEMBERSHIP_ROLE` in `packages/access/src/grants.ts`)
 * so it renders here without a Revoke button; anyone else sees nothing. */
export function InvitePanel() {
  const { message } = App.useApp();
  const { can } = useCan();
  const canCreate = can('create', 'invite');
  const canRead = can('read', 'invite');
  const canRevoke = can('delete', 'invite');

  const { data: invites } = useGetInvitesQuery(undefined, { skip: !canRead });
  const [revokeInvite] = useRevokeInviteMutation();
  const [inviteOpen, setInviteOpen] = useState(false);

  const origin = useMemo(
    () => (typeof window !== 'undefined' && window.location ? window.location.origin : ''),
    [],
  );

  const pendingInvites = useMemo(
    () => (invites ?? []).filter((invite) => invite.status === 'pending'),
    [invites],
  );

  async function handleCopyLink(token: string) {
    try {
      await navigator.clipboard.writeText(`${origin}/invite/${token}`);
      message.success('Link copied');
    } catch {
      message.error('Could not copy — select the text manually');
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      await revokeInvite(inviteId).unwrap();
      message.success('Invite revoked');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not revoke this invite'));
    }
  }

  if (!canCreate && !canRead) return null;

  return (
    <div className="flex flex-col gap-4">
      {canCreate ? (
        <div className="flex justify-end">
          <Button icon={<Plus size={14} />} onClick={() => setInviteOpen(true)}>
            Invite member
          </Button>
        </div>
      ) : null}

      {canRead && pendingInvites.length > 0 ? (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Pending invites
          </h2>
          <ul className="flex flex-col gap-2">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1 text-sm font-medium text-ink">
                    {invite.roles.length > 0 ? (
                      invite.roles.map((role) => (
                        <Tag key={role} className="m-0">
                          {role}
                        </Tag>
                      ))
                    ) : (
                      <Tag className="m-0">Member</Tag>
                    )}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    Expires in {daysUntil(invite.expiresAt)}d
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="small"
                    icon={<LinkIcon size={13} />}
                    onClick={() => void handleCopyLink(invite.token)}
                  >
                    Copy link
                  </Button>
                  {canRevoke ? (
                    <Button size="small" danger onClick={() => void handleRevokeInvite(invite.id)}>
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
