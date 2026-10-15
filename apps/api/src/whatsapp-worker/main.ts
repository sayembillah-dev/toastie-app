/**
 * The WhatsApp worker — its own long-lived process, separate from the API.
 *
 * It holds a dedicated WhatsApp number as a "linked device" through Baileys
 * (the same protocol WhatsApp Web speaks) and exposes a tiny HTTP API on
 * loopback that `WhatsappService` in the API calls: status, connect,
 * disconnect, send.
 *
 * Why a separate process rather than a Nest provider: the API runs as two PM2
 * cluster workers, and two sockets logged into one number knock each other
 * off (WhatsApp's "connection replaced"). It also restarts on every deploy;
 * this process is single-instance (fork mode) — see deploy/ecosystem.config.cjs.
 *
 * Unofficial: WhatsApp can ban a number driven this way. Never link a
 * personal number.
 *
 * Env:
 *   WHATSAPP_API_KEY      shared secret with the API (required)
 *   WHATSAPP_WORKER_PORT  loopback port, default 4100
 *   WHATSAPP_AUTH_DIR     where the linked-device keys live, default
 *                         ./.whatsapp-auth. Must outlive releases in prod.
 *
 * Local dev: `pnpm dev:whatsapp` from the repo root.
 */

import { timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type proto,
  useMultiFileAuthState,
  type WASocket,
} from 'baileys';

import type {
  WhatsappConnectionState,
  WhatsappSendRequest,
  WhatsappSendResult,
  WhatsappWorkerStatus,
} from '@/whatsapp/whatsapp.types';

const API_KEY = process.env.WHATSAPP_API_KEY ?? '';
const PORT = Number(process.env.WHATSAPP_WORKER_PORT || 4100);
const AUTH_DIR = path.resolve(process.env.WHATSAPP_AUTH_DIR || '.whatsapp-auth');
const MAX_BODY_BYTES = 64 * 1024;
const MAX_RECONNECT_DELAY_MS = 60_000;

/** Baileys' logger interface — not re-exported from the package root. */
type ILogger = NonNullable<Parameters<typeof makeWASocket>[0]['logger']>;

/* ------------------------------------------------------------- logging -- */

function log(level: 'info' | 'warn' | 'error', message: string): void {
  console[level](`[whatsapp] ${message}`);
}

/** Baileys logs through pino at `info` by default, which floods PM2's
 * (unrotated) log files. Only its warnings and errors are worth keeping. */
function baileysLogger(): ILogger {
  const noop = () => {};
  const write = (level: 'warn' | 'error') => (obj: unknown, msg?: string) => {
    const detail =
      obj instanceof Error ? obj.message : typeof obj === 'string' ? obj : JSON.stringify(obj);
    log(level, `baileys: ${msg ?? ''} ${(detail ?? '').slice(0, 500)}`.trim());
  };
  const logger: ILogger = {
    level: 'warn',
    child: () => logger,
    trace: noop,
    debug: noop,
    info: noop,
    warn: write('warn'),
    error: write('error'),
  };
  return logger;
}

/* --------------------------------------------------------------- state -- */

let sock: WASocket | null = null;
/** Guards `connect()` across its awaits, so a double-clicked Connect (or a
 * reconnect racing a click) never opens two sockets. */
let opening = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;

let state: WhatsappConnectionState = 'disconnected';
let qr: string | null = null;
let account: WhatsappWorkerStatus['account'] = null;
let lastError: string | null = null;

/** Recently sent messages, for Baileys' `getMessage`: when a recipient's
 * phone can't decrypt a message it asks for a resend, and without this the
 * first message to a new contact can stick at "Waiting for this message". */
const recentlySent = new Map<string, proto.IMessage>();
const RECENT_LIMIT = 200;

function remember(id: string, message: proto.IMessage): void {
  recentlySent.set(id, message);
  if (recentlySent.size > RECENT_LIMIT) {
    const oldest = recentlySent.keys().next().value;
    if (oldest !== undefined) recentlySent.delete(oldest);
  }
}

function status(): WhatsappWorkerStatus {
  return { state, qr: state === 'waiting-for-scan' ? qr : null, account, error: lastError };
}

/** `8801712345678:12@s.whatsapp.net` → `8801712345678`. */
function numberFromJid(jid: string): string {
  return jid.split('@')[0]?.split(':')[0] ?? jid;
}

/** A finished link, not just keys from a QR that was never scanned —
 * Baileys writes `creds.json` as soon as a socket opens, but only fills in
 * `me` once the phone has scanned. */
function hasSavedLogin(): boolean {
  const file = path.join(AUTH_DIR, 'creds.json');
  if (!existsSync(file)) return false;
  try {
    return Boolean((JSON.parse(readFileSync(file, 'utf8')) as { me?: unknown }).me);
  } catch {
    return false;
  }
}

function wipeLogin(): void {
  rmSync(AUTH_DIR, { recursive: true, force: true });
  account = null;
}

/* ---------------------------------------------------------- connection -- */

async function connect(): Promise<void> {
  if (sock || opening) return;
  opening = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  state = 'connecting';
  qr = null;

  try {
    mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 });
    const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    // The WhatsApp Web version Baileys should claim to be. Falls back to the
    // version bundled with the package if the lookup fails.
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth,
      logger: baileysLogger(),
      browser: Browsers.ubuntu('Openfloor'),
      // Leave the phone's own notifications working, and skip the full chat
      // history — this number only ever sends. The default (recent) sync
      // stays on: Baileys needs it for phone-number ↔ LID mappings, and warns
      // that disabling it makes sessions unstable.
      markOnlineOnConnect: false,
      syncFullHistory: false,
      getMessage: async (key) => (key.id ? recentlySent.get(key.id) : undefined),
    });
    sock = socket;

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', (update) => {
      // A late event from a socket we've already replaced or ended.
      if (sock !== socket) return;

      if (update.qr) {
        state = 'waiting-for-scan';
        qr = update.qr;
      }

      if (update.connection === 'open') {
        state = 'connected';
        qr = null;
        lastError = null;
        reconnectAttempts = 0;
        const me = socket.user ?? auth.creds.me;
        account = me ? { number: numberFromJid(me.id), name: me.name ?? null } : null;
        log('info', `connected as ${account?.number ?? 'unknown'}`);
      }

      if (update.connection === 'close') {
        sock = null;
        qr = null;
        const error = update.lastDisconnect?.error as
          | { output?: { statusCode?: number }; message?: string }
          | undefined;
        handleClose(error?.output?.statusCode, Boolean(auth.creds.me), error?.message);
      }
    });
  } catch (error) {
    sock = null;
    state = 'disconnected';
    lastError = `Could not start WhatsApp: ${error instanceof Error ? error.message : error}`;
    log('error', lastError);
  } finally {
    opening = false;
  }
}

function handleClose(code: number | undefined, linked: boolean, message?: string): void {
  log('warn', `connection closed (${code ?? 'no code'}${message ? `: ${message}` : ''})`);

  switch (code) {
    case DisconnectReason.restartRequired:
      // Normal right after a QR scan: WhatsApp drops the pairing socket and
      // expects a fresh login with the new credentials.
      void connect();
      return;
    case DisconnectReason.loggedOut:
      // Unlinked from the phone (or from Disconnect). The saved keys are dead.
      wipeLogin();
      state = 'disconnected';
      lastError = 'WhatsApp logged this device out. Connect again to link a number.';
      return;
    case DisconnectReason.connectionReplaced:
      // Another process logged in with the same keys. Fighting it would just
      // bounce the session back and forth.
      state = 'disconnected';
      lastError = 'Another session took over this number. Connect again to take it back.';
      return;
    case DisconnectReason.forbidden:
      state = 'disconnected';
      lastError = 'WhatsApp refused the connection. The number may be banned or restricted.';
      return;
  }

  if (!linked) {
    // Never finished linking — almost always the QR expiring unscanned.
    // Don't loop: an unattended process would mint QR codes forever. The
    // half-made keys are useless, so the next Connect starts clean.
    wipeLogin();
    state = 'disconnected';
    lastError = 'The QR code expired before it was scanned.';
    return;
  }

  // A dropped line on a linked number: back off and reconnect.
  const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** reconnectAttempts);
  reconnectAttempts += 1;
  state = 'connecting';
  lastError = `Connection lost, reconnecting in ${Math.round(delay / 1000)}s.`;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, delay);
}

async function disconnect(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const socket = sock;
  // Detach first so the close event this triggers is ignored as stale.
  sock = null;
  if (socket) {
    try {
      await socket.logout();
    } catch {
      // Already closed or offline — removing the local keys still unlinks
      // this side; the phone will show the device as inactive.
      socket.end(undefined);
    }
  }
  wipeLogin();
  state = 'disconnected';
  qr = null;
  lastError = null;
  log('info', 'disconnected and removed the saved login');
}

async function send({ number, text }: WhatsappSendRequest): Promise<WhatsappSendResult> {
  const socket = sock;
  if (!socket || state !== 'connected') {
    throw new HttpError(409, 'WhatsApp is not connected');
  }
  const [result] = (await socket.onWhatsApp(number)) ?? [];
  if (!result?.exists) return { status: 'not-on-whatsapp' };

  const sent = await socket.sendMessage(result.jid, { text });
  if (sent?.key.id && sent.message) remember(sent.key.id, sent.message);
  return { status: 'sent', messageId: sent?.key.id ?? null };
}

/* ---------------------------------------------------------------- http -- */

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function authorized(req: IncomingMessage): boolean {
  const given = Buffer.from(String(req.headers['x-api-key'] ?? ''));
  const expected = Buffer.from(API_KEY);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Body too large');
    chunks.push(chunk as Buffer);
  }
  try {
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  } catch {
    throw new HttpError(400, 'Body is not valid JSON');
  }
}

function parseSendRequest(body: unknown): WhatsappSendRequest {
  const { number, text } = (body ?? {}) as Partial<WhatsappSendRequest>;
  if (typeof number !== 'string' || !/^\d{8,15}$/.test(number)) {
    throw new HttpError(400, '`number` must be international digits, e.g. 8801712345678');
  }
  if (typeof text !== 'string' || !text.trim()) {
    throw new HttpError(400, '`text` is required');
  }
  return { number, text };
}

function reply(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  void (async () => {
    try {
      if (!authorized(req)) throw new HttpError(401, 'Unauthorized');
      const route = `${req.method} ${req.url?.split('?')[0]}`;
      switch (route) {
        case 'GET /status':
          return reply(res, 200, status());
        case 'POST /connect':
          await connect();
          return reply(res, 200, status());
        case 'POST /disconnect':
          await disconnect();
          return reply(res, 200, status());
        case 'POST /send':
          return reply(res, 200, await send(parseSendRequest(await readJson(req))));
        default:
          throw new HttpError(404, 'Not found');
      }
    } catch (error) {
      if (error instanceof HttpError) {
        return reply(res, error.statusCode, { message: error.message });
      }
      const message = error instanceof Error ? error.message : String(error);
      log('error', `${req.method} ${req.url} failed: ${message}`);
      return reply(res, 500, { message });
    }
  })();
});

/* ---------------------------------------------------------------- boot -- */

if (API_KEY.length < 16) {
  log('error', 'WHATSAPP_API_KEY must be set (16+ characters) — refusing to start');
  process.exit(1);
}

// Loopback only: whoever can reach this port with the key can send as the
// club's number. Caddy never proxies to it.
server.listen(PORT, '127.0.0.1', () => {
  log('info', `listening on 127.0.0.1:${PORT}, login stored in ${AUTH_DIR}`);
  // Reconnect a number that was linked before this restart (deploys restart
  // the worker). A never-linked number waits for a Super Admin to press
  // Connect, rather than minting QR codes nobody is looking at.
  if (hasSavedLogin()) void connect();
});

function shutdown(): void {
  // `end`, never `logout`: a restart must keep the number linked.
  sock?.end(undefined);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
