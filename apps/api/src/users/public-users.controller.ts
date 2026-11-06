import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';

import { Public } from '@/access';
import { PrismaService } from '@/prisma';

import { hashShareToken, openCredential } from './credential-share';

/** Wire shape returned by `/public/users/:userId/credentials` — exactly
 * what the handoff page renders, nothing more (no email, no role, no
 * account id beyond what's already in the URL). */
export interface CredentialShareWire {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
}

/** Public share endpoint for a freshly-created account's credentials —
 * what the Super Admin's "direct link" / QR code point at.
 *
 * Same shape as `PublicMeetingsController`: looked up on `(userId, token)`
 * together so a wrong token and a nonexistent id both fall out as the same
 * 404. `@Public()` skips both `JwtAuthGuard` and `ContextGuard`, and
 * `routed-base-query` on the client drops `Authorization` for `/public/*`
 * — a leaked link works from a browser with no login, same as the
 * meeting share pages.
 *
 * The row is matched on the token's hash and the password decrypts only with
 * the token from the URL. It is deleted the moment `AuthService.login` sees
 * this user sign in, and stops matching after `expiresAt` — see
 * `CredentialShare` in schema.prisma. */
@Public()
@Controller('public/users')
export class PublicUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':userId/credentials')
  async getCredentials(
    @Param('userId') userId: string,
    @Query('t') token: string | undefined,
  ): Promise<CredentialShareWire> {
    if (!token) {
      throw new NotFoundException('No credentials match that link');
    }
    const row = await this.prisma.credentialShare.findFirst({
      where: { userId, tokenHash: hashShareToken(token), expiresAt: { gt: new Date() } },
      select: { firstName: true, lastName: true, phone: true, passwordCipher: true },
    });
    const password = row?.passwordCipher ? openCredential(token, row.passwordCipher) : null;
    if (!row || password === null) {
      throw new NotFoundException('No credentials match that link');
    }
    return { firstName: row.firstName, lastName: row.lastName, phone: row.phone, password };
  }
}
