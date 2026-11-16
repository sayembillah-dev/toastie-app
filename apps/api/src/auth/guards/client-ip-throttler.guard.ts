import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Per-IP rate limit for the public auth routes, applied route by route with
 * `@UseGuards(ClientIpThrottlerGuard)` + `@Throttle(...)`.
 *
 * The default tracker (`req.ip`) is useless here: Caddy proxies to the API on
 * loopback, so every request comes from 127.0.0.1, and Caddy's `X-Real-IP` is
 * the Cloudflare edge, because the domain is proxied through Cloudflare. The
 * real client is in `CF-Connecting-IP`.
 *
 * This is a SECONDARY control. The counters live in memory, so with two PM2
 * workers the real limit is about double the configured one, and a client
 * that reaches the origin directly can forge the header. The primary limits
 * are the per-target counts in `OtpService`, which live in the database. */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | string[] | undefined>;
    return (
      firstValue(headers['cf-connecting-ip']) ??
      firstValue(headers['x-real-ip']) ??
      (typeof req.ip === 'string' ? req.ip : 'unknown')
    );
  }
}

function firstValue(header: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(header) ? header[0] : header;
  const value = raw?.split(',')[0]?.trim();
  return value ? value : undefined;
}
