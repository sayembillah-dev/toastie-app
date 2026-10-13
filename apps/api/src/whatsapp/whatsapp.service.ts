import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { normalizePhone } from '@/common';

import type {
  WhatsappSendRequest,
  WhatsappSendResult,
  WhatsappStatus,
  WhatsappWorkerStatus,
} from './whatsapp.types';

/** Local 11-digit BD mobile (`01712345678`, the form `normalizePhone()`
 * stores) → WhatsApp's international digits (`8801712345678`). Throws rather
 * than guessing: `normalizePhone('+8801712345678')` deliberately yields 10
 * digits, and prefixing that with `88` would message a different number. */
export function toWhatsappNumber(phone: string): string {
  const local = normalizePhone(phone);
  if (!/^01\d{9}$/.test(local)) {
    throw new Error(`Not a Bangladeshi mobile number: "${phone}"`);
  }
  return `88${local}`;
}

/** The API's handle on the WhatsApp worker process (src/whatsapp-worker),
 * which owns the actual WhatsApp connection. Everything here is a loopback
 * HTTP call with the shared `WHATSAPP_API_KEY`.
 *
 * Unconfigured (no key) is a supported state: `getStatus()` says so and
 * `sendText()` returns `skipped`, so callers never branch on environment. A
 * worker that's down — e.g. mid-restart during a deploy — reports as
 * `worker-offline` rather than throwing. */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('WHATSAPP_API_KEY') || undefined;
    this.baseUrl = `http://127.0.0.1:${config.get<string>('WHATSAPP_WORKER_PORT') || 4100}`;
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  getStatus(): Promise<WhatsappStatus> {
    return this.withStatusFallback(() => this.request<WhatsappWorkerStatus>('GET', '/status'));
  }

  /** Starts linking (the status then carries a QR) or reconnects a number
   * that's already linked. Safe to call twice. */
  connect(): Promise<WhatsappStatus> {
    return this.withStatusFallback(() => this.request<WhatsappWorkerStatus>('POST', '/connect'));
  }

  /** Logs the device out on WhatsApp's side and forgets the saved login —
   * connecting again means scanning a new QR. */
  disconnect(): Promise<WhatsappStatus> {
    return this.withStatusFallback(() => this.request<WhatsappWorkerStatus>('POST', '/disconnect'));
  }

  /** Throws when the worker can't send (offline, not linked) — callers that
   * fire-and-forget should catch and log. */
  async sendText(phone: string, text: string): Promise<WhatsappSendResult> {
    if (!this.isConfigured) return { status: 'skipped' };
    const body: WhatsappSendRequest = { number: toWhatsappNumber(phone), text };
    const result = await this.request<WhatsappSendResult>('POST', '/send', body);
    if (result.status === 'not-on-whatsapp') {
      this.logger.warn(`WhatsApp send skipped — ${body.number} has no WhatsApp account`);
    }
    return result;
  }

  private async withStatusFallback(
    call: () => Promise<WhatsappWorkerStatus>,
  ): Promise<WhatsappStatus> {
    if (!this.isConfigured) {
      return { state: 'not-configured', qr: null, account: null, error: null };
    }
    try {
      return await call();
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return { state: 'worker-offline', qr: null, account: null, error: error.message };
      }
      throw error;
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'X-Api-Key': this.apiKey ?? '',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        // Loopback: anything slower than this is a hung worker. Sends do a
        // WhatsApp round trip, so this is generous rather than tight.
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'The WhatsApp worker is not running. Start it (PM2 app `toastly-whatsapp`, or `pnpm dev:whatsapp` locally).',
      );
    }
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      // 400/409 are the worker's verdict on this request ("not connected") —
      // pass them through. Anything else is the worker failing, and must not
      // surface as e.g. its own 401 (a mismatched key): the web client reads
      // a 401 as the user's session expiring.
      const passThrough = res.status === 400 || res.status === 409;
      throw new HttpException(
        res.status === 401
          ? 'The WhatsApp worker rejected the API key — restart it so it reads the same WHATSAPP_API_KEY as the API.'
          : (payload.message ?? `WhatsApp worker error ${res.status}`),
        passThrough ? res.status : HttpStatus.BAD_GATEWAY,
      );
    }
    return payload as T;
  }
}
