import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '@/prisma';

/** How long a credential-handoff link stays usable if nobody signs in with it. */
export const CREDENTIAL_SHARE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** What the row stores in place of the token and the password. */
export interface SealedCredential {
  tokenHash: string;
  passwordCipher: string;
  expiresAt: Date;
}

export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/** The encryption key comes from the share token itself, which only exists in
 * the link. The server cannot decrypt a row until someone presents the link,
 * so there is no long-lived key to leak alongside the database. */
function keyFor(token: string): Buffer {
  return Buffer.from(hkdfSync('sha256', token, 'openfloor', 'credential-share-password', 32));
}

export function sealCredential(token: string, password: string, now: Date): SealedCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(token), iv);
  const body = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    tokenHash: hashShareToken(token),
    passwordCipher: [iv, tag, body].map((b) => b.toString('base64url')).join('.'),
    expiresAt: new Date(now.getTime() + CREDENTIAL_SHARE_TTL_MS),
  };
}

/** Null when the ciphertext is malformed or was not sealed under this token. */
export function openCredential(token: string, passwordCipher: string): string | null {
  const parts = passwordCipher.split('.');
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, body] = parts.map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', keyFor(token), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Converts rows written before encryption (plaintext `token` + `password`)
 * at boot, and sweeps expired links. Runs before the app starts listening, so
 * the public lookup never has to know the legacy shape existed. */
@Injectable()
export class CredentialShareService implements OnModuleInit {
  private readonly logger = new Logger(CredentialShareService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // Housekeeping only: a database hiccup here must not stop the API from
    // booting. Rows left unconverted are retried on the next start; until
    // then their links 404 rather than serving plaintext.
    try {
      await this.convertLegacyAndSweep(new Date());
    } catch (err) {
      this.logger.error('Credential-handoff housekeeping failed; continuing boot', err as Error);
    }
  }

  private async convertLegacyAndSweep(now: Date): Promise<void> {
    const legacy = await this.prisma.credentialShare.findMany({
      where: { OR: [{ token: { not: null } }, { password: { not: null } }] },
      select: { id: true, token: true, password: true, createdAt: true },
    });
    for (const row of legacy) {
      if (!row.token || !row.password) {
        // Half a legacy row can never be opened again — drop it.
        await this.prisma.credentialShare.delete({ where: { id: row.id } });
        continue;
      }
      const sealed = sealCredential(row.token, row.password, row.createdAt);
      await this.prisma.credentialShare.update({
        where: { id: row.id },
        data: {
          ...sealed,
          // Old links were promised to work until first sign-in; give them a
          // full window from today rather than expiring them on deploy.
          expiresAt: new Date(now.getTime() + CREDENTIAL_SHARE_TTL_MS),
          token: null,
          password: null,
        },
      });
    }
    if (legacy.length > 0) {
      this.logger.log(`Encrypted ${legacy.length} legacy credential-handoff row(s)`);
    }
    await this.sweepExpired(now);
  }

  async sweepExpired(now: Date): Promise<void> {
    await this.prisma.credentialShare.deleteMany({ where: { expiresAt: { lte: now } } });
  }
}
