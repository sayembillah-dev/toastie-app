import { createHash, randomBytes } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createId } from '@paralleldrive/cuid2';
import * as argon2 from 'argon2';

import { PrismaService } from '@/prisma';

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

interface JwtPayload {
  sub: string;
}

/** Access tokens are JWTs (15-min default TTL) signed with `JWT_ACCESS_SECRET`.
 * Refresh tokens are opaque random strings — no need for claims, since the
 * only thing the server does with them is look up a `RefreshToken` row by
 * hash. See §Locked-decisions in the plan for the "short access TTL +
 * rotating refresh with family reuse detection" mitigation model.
 *
 * A refresh replay (the client sends a token whose `revokedAt` is already
 * set) is treated as a stolen credential: the whole `familyId` is revoked,
 * forcing the legitimate user to log in again. This is the single most
 * important behavior in this file — do not soften it. */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = parseTtlToSeconds(config.get<string>('JWT_ACCESS_TTL') ?? '15m');
    this.refreshTtlSeconds = parseTtlToSeconds(config.get<string>('JWT_REFRESH_TTL') ?? '30d');
  }

  async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch (err) {
      this.logger.warn(`argon2 verify threw: ${(err as Error).message}`);
      return false;
    }
  }

  async issueTokens(userId: string, now: Date): Promise<IssuedTokens> {
    const minted = await this.mint(userId, createId(), now);
    return minted.tokens;
  }

  async rotateRefreshToken(raw: string, now: Date): Promise<IssuedTokens> {
    const tokenHash = hashRefreshToken(raw);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!existing) throw new UnauthorizedException({ code: 'REFRESH_UNKNOWN' });

    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId, now);
      this.logger.warn(
        `refresh reuse detected for family ${existing.familyId} (user ${existing.userId})`,
      );
      throw new UnauthorizedException({ code: 'REFRESH_REUSE' });
    }

    if (existing.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException({ code: 'REFRESH_EXPIRED' });
    }

    const minted = await this.mint(existing.userId, existing.familyId, now);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: now, replacedById: minted.rowId },
    });
    return minted.tokens;
  }

  /** Revoke a single refresh token (regular logout). */
  async revokeByRawToken(raw: string, now: Date): Promise<void> {
    const tokenHash = hashRefreshToken(raw);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (!payload?.sub || typeof payload.sub !== 'string') {
        throw new UnauthorizedException({ code: 'ACCESS_MALFORMED' });
      }
      return { userId: payload.sub };
    } catch {
      throw new UnauthorizedException({ code: 'ACCESS_INVALID' });
    }
  }

  private async mint(
    userId: string,
    familyId: string,
    now: Date,
  ): Promise<{ tokens: IssuedTokens; rowId: string }> {
    const accessExpiresAt = new Date(now.getTime() + this.accessTtlSeconds * 1000);
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTtlSeconds * 1000);

    const accessToken = await this.jwtService.signAsync({ sub: userId } satisfies JwtPayload, {
      expiresIn: this.accessTtlSeconds,
    });

    const refreshToken = generateRefreshToken();
    const row = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        familyId,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      tokens: {
        accessToken,
        accessTokenExpiresAt: accessExpiresAt.toISOString(),
        refreshToken,
        refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      },
      rowId: row.id,
    };
  }
}

/** 32 bytes of entropy, base64url — 43 chars, url-safe, plenty of headroom
 * against birthday collisions across 100 clubs × 1,000 users × decades. */
function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('base64url');
}

/** Accepts `"15m" | "30d" | "3600"` etc. Falls back to seconds if the
 * suffix is missing or unknown, so `"3600"` and `"3600s"` are equivalent. */
function parseTtlToSeconds(raw: string): number {
  const trimmed = raw.trim();
  const match = /^(\d+)([smhdw]?)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid TTL: "${raw}"`);
  }
  const value = Number(match[1]);
  const unit = match[2] || 's';
  const scale = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[unit];
  if (scale === undefined) throw new Error(`Invalid TTL unit: "${unit}"`);
  return value * scale;
}
