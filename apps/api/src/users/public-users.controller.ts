import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';

import { Public } from '@/access';
import { PrismaService } from '@/prisma';

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
 * The row is deleted the moment `AuthService.login` sees this user log in
 * successfully, so once the recipient has actually signed in, the link
 * stops working — see `CredentialShare` in schema.prisma. */
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
      where: { userId, token },
      select: { firstName: true, lastName: true, phone: true, password: true },
    });
    if (!row) {
      throw new NotFoundException('No credentials match that link');
    }
    return row;
  }
}
