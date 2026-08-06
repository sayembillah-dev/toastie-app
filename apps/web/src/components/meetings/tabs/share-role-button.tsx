'use client';

import { Copy, DownloadSimple, QrCode } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Input, Modal, QRCode, Tooltip } from 'antd';
import { useMemo, useRef, useState } from 'react';

import type { RoleKind } from '@/lib/meetings/role-state';
import { useGetMeetingQuery } from '@/store/api';

interface ShareRoleButtonProps {
  meetingId: string;
  kind: RoleKind;
  /** Human-readable role name for the modal header ("Ah Counter", "Timer", …). */
  roleLabel: string;
  ariaLabel: string;
}

/** QR + copy-link button used from each role tab. Mirrors the evaluation QR
 * button on Prepared Speakers — same modal shape and canvas → PNG download so
 * the share affordance reads the same across the app.
 *
 * The link carries the meeting's `shareToken` — anonymous visitors hit
 * `/public/meetings/:id?t=<token>` for the header data, and a bare id
 * without the token is a 404. The token IS the capability. */
export function ShareRoleButton({ meetingId, kind, roleLabel, ariaLabel }: ShareRoleButtonProps) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const { data: meeting } = useGetMeetingQuery(meetingId, { skip: !meetingId });

  const url = useMemo(() => {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    if (!meeting) return '';
    const token = encodeURIComponent(meeting.shareToken);
    return `${origin}/meetings/${meetingId}/roles/${kind}?t=${token}`;
  }, [meetingId, kind, meeting]);

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      message.success(`${roleLabel} link copied`);
    } catch {
      message.error('Could not copy link');
    }
  }

  function handleDownload() {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `${kind}-role-qr.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  return (
    <>
      <Tooltip title={`Share ${roleLabel} link`}>
        <Button
          type="text"
          size="small"
          aria-label={ariaLabel}
          icon={<QrCode size={18} className="text-ink-muted" />}
          onClick={() => setOpen(true)}
        />
      </Tooltip>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        centered
        width={440}
        destroyOnHidden
        title={null}
        styles={{ body: { padding: 0 } }}
        classNames={{ body: 'overflow-hidden rounded-b-2xl' }}
      >
        <div className="flex flex-col">
          <div className="border-b border-line px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Role link
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold text-ink">{roleLabel}</h3>
            <p className="mt-0.5 truncate text-xs text-ink-soft">
              Anyone with this link can operate the {roleLabel.toLowerCase()} for this meeting.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 px-6 pt-6">
            <div
              ref={qrWrapRef}
              className="rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <QRCode
                value={url || ' '}
                size={224}
                bordered={false}
                errorLevel="M"
                color="#1c1c1c"
                bgColor="#ffffff"
              />
            </div>
            <p className="text-center text-[11px] text-ink-muted">
              Scan with a phone camera to open the {roleLabel.toLowerCase()} page.
            </p>
          </div>

          <div className="flex flex-col gap-3 px-6 pb-6 pt-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Or share the link
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={url} size="large" className="!bg-fill !text-ink" />
              <Button
                size="large"
                icon={<Copy size={16} />}
                onClick={handleCopy}
                aria-label={`Copy ${roleLabel} link`}
              >
                Copy
              </Button>
            </div>
            <Button
              block
              type="primary"
              size="large"
              icon={<DownloadSimple size={16} weight="bold" />}
              onClick={handleDownload}
            >
              Download QR as image
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
