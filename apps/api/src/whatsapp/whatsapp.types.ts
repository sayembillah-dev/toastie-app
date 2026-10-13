/** Wire types shared by the WhatsApp worker process (src/whatsapp-worker)
 * and the API's `WhatsappService` that talks to it. Kept dependency-free so
 * the worker can import it without pulling in Nest. */

/** The linked number's connection, as the worker sees it.
 * - `disconnected` — no socket. Either never linked, logged out, or a
 *   non-recoverable close (see `error`). Needs a Super Admin to Connect.
 * - `connecting` — socket opening, or reconnecting after a dropped line.
 * - `waiting-for-scan` — a fresh link: `qr` holds the code to scan.
 * - `connected` — linked and able to send. */
export type WhatsappConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'waiting-for-scan'
  | 'connected';

export interface WhatsappWorkerStatus {
  state: WhatsappConnectionState;
  /** Raw QR payload, only while `waiting-for-scan`. Rotates every ~20s. */
  qr: string | null;
  /** The linked WhatsApp account — null until a QR has been scanned. */
  account: { number: string; name: string | null } | null;
  /** Why the last connection ended, when it ended badly. */
  error: string | null;
}

/** What the API reports to the dashboard: the worker's own status, plus the
 * two states the worker can't report about itself. */
export type WhatsappStatus =
  | WhatsappWorkerStatus
  | {
      /** WHATSAPP_API_KEY isn't set — the feature is off. */
      state: 'not-configured' | 'worker-offline';
      qr: null;
      account: null;
      error: string | null;
    };

export interface WhatsappSendRequest {
  /** International digits, no `+` — e.g. `8801712345678`. */
  number: string;
  text: string;
}

export type WhatsappSendResult =
  | { status: 'sent'; messageId: string | null }
  /** The number is valid but has no WhatsApp account behind it. */
  | { status: 'not-on-whatsapp' }
  /** The feature is off — the same deliberate no-op as an unkeyed
   * `PushService.send()`. Only the API returns this; the worker never does. */
  | { status: 'skipped' };
