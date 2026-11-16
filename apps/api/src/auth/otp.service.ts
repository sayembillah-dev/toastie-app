import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OtpChannel, OtpPurpose } from '@prisma/client';

import { PrismaService } from '@/prisma';

/** How long a code stays usable. */
export const OTP_TTL_MINUTES = 10;
/** Verify attempts per code, the correct one included. */
export const OTP_MAX_ATTEMPTS = 5;
/** Minimum gap between two codes for the same target and purpose. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Per-target send limits, counted from `OtpCode` rows in the database — the
 * primary abuse control. They hold across both PM2 workers and whatever IP
 * the requests come from. WhatsApp is stricter: every message spends the
 * reputation of one real SIM, and an unofficial client gets banned for
 * volume. */
const SEND_LIMITS: Record<OtpChannel, { max: number; windowMs: number }> = {
  email: { max: 5, windowMs: 60 * 60_000 },
  whatsapp: { max: 3, windowMs: 24 * 60 * 60_000 },
};

export interface IssueOtpInput {
  channel: OtpChannel;
  /** Email address or local phone number — normalised here. */
  target: string;
  purpose: OtpPurpose;
  userId?: string | null;
}

export type IssueOtpResult =
  | { ok: true; code: string }
  /** `cooldown`: a code went out less than a minute ago. `limit`: the
   * per-target window is full. Callers on public routes must not reveal
   * either to the client — both look exactly like success. */
  | { ok: false; reason: 'cooldown' | 'limit' };

export interface VerifyOtpInput {
  channel: OtpChannel;
  target: string;
  purpose: OtpPurpose;
  code: string;
}

/** `userId` is the account the code was issued for (null for sign-up). */
export type VerifyOtpResult = { ok: true; userId: string | null } | { ok: false };

/** Issues and checks one-time codes for every channel and purpose.
 *
 * - Codes are 6 random digits from `crypto.randomInt`.
 * - Only an HMAC-SHA256 of `channel:purpose:target:code` is stored. The key
 *   is derived from `JWT_ACCESS_SECRET` with a fixed label, so no new secret
 *   has to be provisioned; binding target and purpose into the input means a
 *   code can never verify for another address or another flow.
 * - Issuing a new code retires every older live code for the same target and
 *   purpose (only the newest code works).
 * - A code dies after `OTP_MAX_ATTEMPTS` verify attempts, after
 *   `OTP_TTL_MINUTES`, or on first successful use. */
@Injectable()
export class OtpService {
  private readonly hmacKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_ACCESS_SECRET') ?? '';
    this.hmacKey = createHmac('sha256', secret).update('openfloor/otp-code/v1').digest();
  }

  async issue(input: IssueOtpInput, now = new Date()): Promise<IssueOtpResult> {
    const target = normaliseTarget(input.channel, input.target);
    const limit = SEND_LIMITS[input.channel];

    const recent = await this.prisma.otpCode.findMany({
      where: {
        target,
        purpose: input.purpose,
        createdAt: { gt: new Date(now.getTime() - limit.windowMs) },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const newest = recent[0]?.createdAt;
    if (newest && now.getTime() - newest.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      return { ok: false, reason: 'cooldown' };
    }
    if (recent.length >= limit.max) {
      return { ok: false, reason: 'limit' };
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.$transaction([
      // Retire older live codes. `expiresAt` is pulled back rather than the
      // row deleted, so it still counts towards the send limit above.
      this.prisma.otpCode.updateMany({
        where: { target, purpose: input.purpose, consumedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      }),
      this.prisma.otpCode.create({
        data: {
          channel: input.channel,
          target,
          purpose: input.purpose,
          userId: input.userId ?? null,
          codeHash: this.hash(input.channel, input.purpose, target, code),
          expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    return { ok: true, code };
  }

  /** Every failure — no code, expired, used, out of attempts, wrong digits —
   * returns the same `{ ok: false }`, so a caller cannot leak which one. */
  async verify(input: VerifyOtpInput, now = new Date()): Promise<VerifyOtpResult> {
    const target = normaliseTarget(input.channel, input.target);
    if (!/^\d{6}$/.test(input.code)) return { ok: false };

    const row = await this.prisma.otpCode.findFirst({
      where: {
        channel: input.channel,
        target,
        purpose: input.purpose,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, userId: true },
    });
    if (!row) return { ok: false };

    // Spend an attempt BEFORE comparing. If the compare came first, N
    // parallel requests could all read `attempts < max` and all get a guess;
    // reserving the attempt with a conditional update caps the guesses at
    // `OTP_MAX_ATTEMPTS` no matter how many requests race.
    const reserved = await this.prisma.otpCode.updateMany({
      where: { id: row.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (reserved.count === 0) return { ok: false };

    const expected = Buffer.from(row.codeHash, 'base64url');
    const actual = Buffer.from(
      this.hash(input.channel, input.purpose, target, input.code),
      'base64url',
    );
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return { ok: false };
    }

    // Consume with a compare-and-set, so two requests with the right code
    // cannot both succeed.
    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: row.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count === 0) return { ok: false };
    return { ok: true, userId: row.userId };
  }

  private hash(channel: OtpChannel, purpose: OtpPurpose, target: string, code: string): string {
    return createHmac('sha256', this.hmacKey)
      .update(`${channel}:${purpose}:${target}:${code}`)
      .digest('base64url');
  }
}

/** Emails are compared case-insensitively everywhere (`User.email` is
 * CITEXT), but `OtpCode.target` is plain TEXT — so lower-case on the way in,
 * on both issue and verify. */
export function normaliseTarget(channel: OtpChannel, target: string): string {
  const trimmed = target.trim();
  return channel === 'email' ? trimmed.toLowerCase() : trimmed;
}
