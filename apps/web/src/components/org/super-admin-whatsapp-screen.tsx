'use client';

import { LinkBreak, PaperPlaneTilt, WhatsappLogo } from '@phosphor-icons/react/dist/ssr';
import { Alert, App, Button, Input, QRCode, Skeleton, Spin, Tag } from 'antd';
import { useState } from 'react';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import {
  useConnectWhatsappMutation,
  useDisconnectWhatsappMutation,
  useGetWhatsappStatusQuery,
  useSendWhatsappTestMessageMutation,
  type WhatsappState,
  type WhatsappStatus,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const STATE_TAG: Record<WhatsappState, { color: string; label: string }> = {
  'not-configured': { color: 'default', label: 'Not set up' },
  'worker-offline': { color: 'error', label: 'Worker offline' },
  disconnected: { color: 'default', label: 'Not connected' },
  connecting: { color: 'processing', label: 'Connecting' },
  'waiting-for-scan': { color: 'processing', label: 'Waiting for scan' },
  connected: { color: 'success', label: 'Connected' },
};

/** States that change without anyone touching this page — the QR rotates,
 * a scan completes, a dropped line reconnects — so the page polls while in
 * them, and only then. */
const LIVE_STATES: ReadonlySet<WhatsappState> = new Set(['connecting', 'waiting-for-scan']);

/** Super Admin's control panel for the club WhatsApp number: link it by
 * scanning a QR, see whether it's connected, unlink it, and send a test
 * message. The connection itself lives in the API's separate WhatsApp worker
 * process; this page only drives it. */
export function SuperAdminWhatsappScreen() {
  const [pollingInterval, setPollingInterval] = useState(0);
  const { data, isLoading, isError, error, refetch } = useGetWhatsappStatusQuery(undefined, {
    pollingInterval,
    skipPollingIfUnfocused: true,
  });
  // The interval depends on the data the query returns, so it's adjusted
  // during render (React's documented pattern) rather than in an effect.
  const nextInterval = data && LIVE_STATES.has(data.state) ? 2000 : 0;
  if (nextInterval !== pollingInterval) setPollingInterval(nextInterval);

  return (
    <>
      <PageBreadcrumb
        trail={[
          { href: '/super-admin', title: 'Super Admin' },
          { href: '/super-admin/whatsapp', title: 'WhatsApp' },
        ]}
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-ink">WhatsApp</h1>
          <p className="text-sm text-ink-soft">
            The number Openfloor sends WhatsApp messages from. Link a dedicated number — never a
            personal one — by scanning the QR code from that phone.
          </p>
        </header>

        <section className="rounded-xl border border-line bg-canvas p-5">
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : isError || !data ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-ink">Could not load the WhatsApp status</p>
              <p className="text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
              <Button size="small" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <StatusPanel status={data} onRetry={() => refetch()} />
          )}
        </section>

        {data?.state === 'connected' ? <TestMessageCard /> : null}
      </div>
    </>
  );
}

function StatusPanel({ status, onRetry }: { status: WhatsappStatus; onRetry: () => void }) {
  const { message, modal } = App.useApp();
  const [connect, connectMut] = useConnectWhatsappMutation();
  const [disconnect, disconnectMut] = useDisconnectWhatsappMutation();
  const tag = STATE_TAG[status.state];

  async function handleConnect() {
    try {
      await connect().unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not start connecting'));
    }
  }

  async function runDisconnect(successText: string) {
    try {
      await disconnect().unwrap();
      message.success(successText);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not disconnect'));
    }
  }

  function confirmDisconnect() {
    modal.confirm({
      title: 'Disconnect WhatsApp?',
      content:
        'Openfloor stops sending WhatsApp messages until a number is linked again, which means scanning a new QR code.',
      okText: 'Disconnect',
      okButtonProps: { danger: true },
      onOk: () => runDisconnect('WhatsApp disconnected'),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <WhatsappLogo size={20} weight="fill" className="text-ink-soft" />
        <span className="text-sm font-medium text-ink">Status</span>
        <Tag color={tag.color} className="m-0">
          {tag.label}
        </Tag>
      </div>

      {status.error && status.state !== 'worker-offline' ? (
        <Alert type="warning" showIcon message={status.error} />
      ) : null}

      {status.state === 'not-configured' ? (
        <p className="text-sm text-ink-soft">
          WhatsApp is switched off on this server. Set <code>WHATSAPP_API_KEY</code> in the
          server&rsquo;s environment and redeploy to turn it on.
        </p>
      ) : null}

      {status.state === 'worker-offline' ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-ink-soft">
            The WhatsApp worker isn&rsquo;t running, so nothing can be sent. It restarts on its own
            after a deploy — if this persists, check the <code>toastly-whatsapp</code> process on
            the server.
          </p>
          <Button size="small" onClick={onRetry}>
            Check again
          </Button>
        </div>
      ) : null}

      {status.state === 'disconnected' ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-ink-soft">
            No number is linked. Connect to get a QR code, then scan it from the phone that holds
            the club&rsquo;s WhatsApp number.
          </p>
          <Button
            type="primary"
            icon={<WhatsappLogo size={15} weight="bold" />}
            loading={connectMut.isLoading}
            onClick={() => void handleConnect()}
          >
            Connect WhatsApp
          </Button>
        </div>
      ) : null}

      {status.state === 'connecting' ? (
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          <Spin size="small" />
          Connecting to WhatsApp…
        </div>
      ) : null}

      {status.state === 'waiting-for-scan' && status.qr ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <QRCode value={status.qr} size={220} bordered className="shrink-0 bg-white" />
          <div className="flex flex-col gap-3">
            <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-sm text-ink-soft">
              <li>Open WhatsApp on the club&rsquo;s phone.</li>
              <li>
                Go to <strong>Settings → Linked devices → Link a device</strong>.
              </li>
              <li>Point the camera at this code.</li>
            </ol>
            <p className="text-xs text-ink-muted">
              The code refreshes every few seconds and expires after about a minute unscanned.
            </p>
            <Button
              size="small"
              className="self-start"
              loading={disconnectMut.isLoading}
              onClick={() => void runDisconnect('Linking cancelled')}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {status.state === 'connected' && status.account ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink">+{status.account.number}</span>
            {status.account.name ? (
              <span className="text-xs text-ink-muted">{status.account.name}</span>
            ) : null}
          </div>
          <Button
            danger
            icon={<LinkBreak size={15} weight="bold" />}
            loading={disconnectMut.isLoading}
            onClick={confirmDisconnect}
          >
            Disconnect
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TestMessageCard() {
  const { message } = App.useApp();
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('Test message from Openfloor ✅');
  const [send, sendMut] = useSendWhatsappTestMessageMutation();

  async function handleSend() {
    try {
      const result = await send({ phone: phone.trim(), text }).unwrap();
      if (result.status === 'sent') message.success('Message sent');
      else if (result.status === 'not-on-whatsapp')
        message.warning('That number has no WhatsApp account');
      else message.warning('WhatsApp is switched off on this server');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not send the message'));
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-5">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-sm font-medium text-ink">Send a test message</h2>
        <p className="m-0 text-xs text-ink-muted">
          Start with a number that has the club&rsquo;s number saved — messages to strangers are
          what get a number flagged.
        </p>
      </div>
      <Input
        placeholder="01XXXXXXXXX"
        inputMode="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        className="max-w-xs"
      />
      <Input.TextArea
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoSize={{ minRows: 2, maxRows: 6 }}
        maxLength={1000}
      />
      <Button
        type="primary"
        icon={<PaperPlaneTilt size={15} weight="bold" />}
        className="self-start"
        loading={sendMut.isLoading}
        disabled={!phone.trim() || !text.trim()}
        onClick={() => void handleSend()}
      >
        Send
      </Button>
    </section>
  );
}
