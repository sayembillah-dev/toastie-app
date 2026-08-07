import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SessionResponse } from '@toastly/access';

import { SubjectFactory } from '@/access';
import { PrismaService } from '@/prisma';

import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { type IssuedTokens, TokenService } from './token.service';

export interface AuthResult {
  tokens: IssuedTokens;
  session: SessionResponse;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly subjectFactory: SubjectFactory,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const phone = normalisePhone(dto.phone);
    const email = dto.email ? dto.email.trim().toLowerCase() : null;
    const passwordHash = await this.tokens.hashPassword(dto.password);

    let user: { id: string };
    try {
      user = await this.prisma.user.create({
        data: {
          phone,
          email,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
        },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // `meta.target` names the offending unique index — distinguish phone
        // vs. email so the register form can highlight the right field.
        const target = err.meta?.target;
        const takenField = Array.isArray(target)
          ? target.find((t) => t === 'email' || t === 'phone')
          : typeof target === 'string' && (target === 'email' || target === 'phone')
            ? target
            : undefined;
        throw new ConflictException({
          code: takenField === 'email' ? 'EMAIL_TAKEN' : 'PHONE_TAKEN',
        });
      }
      throw err;
    }

    const now = new Date();
    const tokens = await this.tokens.issueTokens(user.id, now);
    const session = await this.subjectFactory.loadSession(user.id, now.getTime());
    if (!session) {
      // A user we just created should always load — treat as an infra fault.
      throw new UnauthorizedException({ code: 'SESSION_LOAD_FAILED' });
    }
    return { tokens, session };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const phone = normalisePhone(dto.phone);
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, passwordHash: true, status: true },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    const passwordOk = await this.tokens.verifyPassword(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException({ code: 'USER_SUSPENDED' });
    }

    // Consume the credential-handoff link (if one exists) the moment the
    // recipient actually signs in — best-effort `deleteMany` so a login
    // never fails over a row that may already be gone.
    await this.prisma.credentialShare.deleteMany({ where: { userId: user.id } });

    const now = new Date();
    const tokens = await this.tokens.issueTokens(user.id, now);
    const session = await this.subjectFactory.loadSession(user.id, now.getTime());
    if (!session) {
      throw new UnauthorizedException({ code: 'SESSION_LOAD_FAILED' });
    }
    return { tokens, session };
  }

  /** Self-service password change — the account holder rotating their own
   * credential, as opposed to `UsersService.setPassword` (an admin choosing
   * it for them). No session revocation: this request is already running
   * on a session the user controls, so there's nothing to force out. */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    }
    const currentOk = await this.tokens.verifyPassword(user.passwordHash, dto.currentPassword);
    if (!currentOk) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    const passwordHash = await this.tokens.hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const now = new Date();
    const tokens = await this.tokens.rotateRefreshToken(rawRefreshToken, now);
    // `rotateRefreshToken` returns tokens keyed to the same userId as the
    // old one; extract it via the new access token so we don't have to
    // thread it back through TokenService's return.
    const { userId } = await this.tokens.verifyAccessToken(tokens.accessToken);
    const session = await this.subjectFactory.loadSession(userId, now.getTime());
    if (!session) {
      throw new UnauthorizedException({ code: 'SESSION_LOAD_FAILED' });
    }
    return { tokens, session };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    await this.tokens.revokeByRawToken(rawRefreshToken, new Date());
  }

  async loadSession(userId: string): Promise<SessionResponse> {
    const session = await this.subjectFactory.loadSession(userId, Date.now());
    if (!session) throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    return session;
  }
}

/** Strip user-friendly whitespace and dashes from the phone before hitting
 * the DB. Keeps the leading `+` (E.164 marker). Callers that display the
 * phone back to the user should render this canonical form; the register
 * form's placeholder tells them what to type, so no round-trip surprise. */
function normalisePhone(raw: string): string {
  return raw.trim().replace(/[\s-]/g, '');
}
