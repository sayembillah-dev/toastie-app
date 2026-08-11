'use client';

import { Copy } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Skeleton } from 'antd';

import { useCan } from '@/lib/permissions/use-can';
import { useGetClubJoinCodeQuery } from '@/store/api';

/** The club's standing join code — a Club Admin copies this and hands it to
 * someone directly (text, verbally, etc.); pasting it into the onboarding
 * screen's "Paste club code" field joins them instantly as a plain Member,
 * no approval step. Gated on `club:update`, the same grant that lets a Club
 * Admin rename the club — a plain Member never sees this. */
export function ClubCodePanel() {
  const { message } = App.useApp();
  const { can } = useCan();
  const canView = can('update', 'club');

  const { data, isLoading } = useGetClubJoinCodeQuery(undefined, { skip: !canView });

  async function handleCopy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.code);
      message.success('Club code copied');
    } catch {
      message.error('Could not copy — select the code manually');
    }
  }

  if (!canView) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">Club join code</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Share this with someone directly — they paste it in to join as a Member instantly.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isLoading || !data ? (
          <Skeleton.Button active size="large" style={{ width: 128 }} />
        ) : (
          <span className="rounded-lg bg-fill px-3 py-1.5 font-mono text-base font-semibold tracking-[0.2em] text-ink">
            {data.code}
          </span>
        )}
        <Button icon={<Copy size={14} />} disabled={!data} onClick={() => void handleCopy()}>
          Copy
        </Button>
      </div>
    </div>
  );
}
