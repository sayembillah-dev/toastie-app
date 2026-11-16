import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { SessionResponse } from '@toastly/access';

import { SubjectFactory } from '@/access';
import { resolveNames } from '@/common';
import { IdentityService } from '@/identity';
import { maskEmail } from '@/mail';
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
  /** `PHONE_LOGIN_RESTRICTED`, read once. See `login`. */
  private readonly phoneLoginRestricted: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly subjectFactory: SubjectFactory,
    private readonly identity: IdentityService,
    config: ConfigService,
  ) {
    this.phoneLoginRestricted = config.get<string>('PHONE_LOGIN_RESTRICTED') === 'true';
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const phone = dto.phone;
    const email = dto.email ? dto.email.trim().toLowerCase() : null;
    const passwordHash = await this.tokens.hashPassword(dto.password);
    // Single `name` input or the legacy first/last pair — one of them must
    // produce at least a first name.
    const names = resolveNames(dto);
    if (!names) {
      throw new BadRequestException({
        code: 'NAME_REQUIRED',
        message: 'Provide your full name',
      });
    }

    let user: { id: string };
    try {
      user = await this.prisma.user.create({
        data: {
          phone,
          email,
          passwordHash,
          firstName: names.firstName,
          lastName: names.lastName,
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

    // Claim every roster row a club added with this phone number before the
    // person had an account. Meeting history keys off `membershipId`, never
    // `userId`, so this single update is the entire "migration" — nothing
    // moves, the rows simply gain an owner. Best-effort: a pathological
    // duplicate (the same number rostered twice in one club) would trip the
    // (clubId, userId) unique index, and that must never fail sign-up.
    try {
      await this.prisma.membership.updateMany({
        where: { phone, userId: null },
        data: { userId: user.id },
      });
    } catch {
      // Officer tooling can relink the spare row by hand later.
    }

    // Claim the global identity behind this number: every guest/roster row
    // clubs recorded pre-account now attaches to it, and the account's name
    // becomes canonical everywhere. Best-effort for the same reason as the
    // roster claim above — a sign-up must never fail over identity linking.
    try {
      await this.identity.claimPerson(user.id);
    } catch {
      // Officer tooling can relink by hand later.
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

  /** Sign-in by email (the new way) or phone. The checks run in a fixed
   * order so no answer reveals more than the caller has proven:
   *
   *   1. Find the account. None found → still run a full password check
   *      against a dummy hash, so the timing matches a wrong password.
   *   2. Wrong password → `401 INVALID_CREDENTIALS` (same as no account).
   *   3. Suspended → `401 USER_SUSPENDED` (only after a correct password).
   *   4. Phone sign-in on an account with a verified email, while
   *      `PHONE_LOGIN_RESTRICTED` is on → `403 PHONE_LOGIN_DISABLED` with the
   *      masked email to use instead. 403, not 401: clients read 401 as an
   *      expired session. */
  async login(dto: LoginDto): Promise<AuthResult> {
    if ((dto.email === undefined) === (dto.phone === undefined)) {
      throw new BadRequestException({
        code: 'LOGIN_IDENTIFIER_REQUIRED',
        message: 'Sign in with either your email or your phone number.',
      });
    }
    const byEmail = dto.email !== undefined;
    const user = await this.prisma.user.findUnique({
      where: byEmail ? { email: dto.email } : { phone: dto.phone },
      select: { id: true, passwordHash: true, status: true, email: true, emailVerifiedAt: true },
    });
    const passwordOk = user
      ? await this.tokens.verifyPassword(user.passwordHash, dto.password)
      : await this.tokens.verifyAgainstDummy(dto.password);
    if (!user || !passwordOk) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException({ code: 'USER_SUSPENDED' });
    }
    if (!byEmail && this.phoneLoginRestricted && user.emailVerifiedAt && user.email) {
      throw new ForbiddenException({
        code: 'PHONE_LOGIN_DISABLED',
        message: 'Sign in with your email address instead.',
        email: maskEmail(user.email),
      });
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
