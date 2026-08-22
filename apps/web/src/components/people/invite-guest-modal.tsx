'use client';

import {
  ArrowsClockwise,
  Copy,
  Link as LinkIcon,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Modal, Popconfirm, QRCode, Spin } from 'antd';
import { useMemo } from 'react';

import { useGetGuestInviteLinkQuery, useRotateGuestInviteLinkMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface InviteGuestModalProps {
  open: boolean;
  onClose: () => void;
}

/** The "Invite guest" dialog on People → Guests — the club's standing public
 * self-signup link (`/guest-invite/<token>`) shown as a QR + copyable URL.
 * Unlike the single-use member invites this is one link per club that works
 * indefinitely: anyone who opens it adds themselves to the guest pipeline
 * with just a name and number. Regenerating invalidates every shared copy. */
export function InviteGuestModal({ open, onClose }: InviteGuestModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title="Invite guests" footer={null} destroyOnHidden>
      <ModalBody />
    </Modal>
  );
}

function ModalBody() {
  const { message } = App.useApp();
  const { data, isLoading, isError, error, refetch } = useGetGuestInviteLinkQuery();
  const [rotate, { isLoading: isRotating }] = useRotateGuestInviteLinkMutation();

  const origin = useMemo(
    () => (typeof window !== 'undefined' && window.location ? window.location.origin : ''),
    [],
  );
  const inviteUrl = data ? `${origin}/guest-invite/${data.token}` : '';

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      message.success('Link copied');
    } catch {
      message.error('Could not copy — select the text manually');
    }
  }

  async function handleRotate() {
    try {
      await rotate().unwrap();
      message.success('Link regenerated — the old one no longer works');
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't regenerate the link. Please try again."));
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spin />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <WarningCircle size={22} className="text-ink-muted" aria-hidden />
        <p className="text-sm text-ink-soft">
          {getApiErrorMessage(error, "Couldn't load the invite link.")}
        </p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-muted">
        Anyone with this link or QR can add themselves to the guest list with just their name and
        number — print it for the venue or drop it in a WhatsApp group. It keeps working until you
        regenerate it.
      </p>

      <div className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center justify-center rounded-md bg-canvas p-1.5">
          <QRCode value={inviteUrl} size={104} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-xs font-medium text-ink">Guest sign-up link</p>
          <p className="truncate text-xs text-ink-muted" title={inviteUrl}>
            {inviteUrl}
          </p>
          <div>
            <Button size="small" icon={<LinkIcon size={13} />} onClick={handleCopyLink}>
              Copy link
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Popconfirm
          title="Regenerate the link?"
          description="Every copy of the current link and QR stops working immediately."
          okText="Regenerate"
          okButtonProps={{ danger: true }}
          onConfirm={handleRotate}
        >
          <Button size="small" icon={<ArrowsClockwise size={14} />} loading={isRotating}>
            Regenerate
          </Button>
        </Popconfirm>
        <Button type="primary" icon={<Copy size={14} />} onClick={handleCopyLink}>
          Copy link
        </Button>
      </div>
    </div>
  );
}
