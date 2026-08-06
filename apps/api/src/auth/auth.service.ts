import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SessionResponse } from '@toastly/access';

import { SubjectFactory } from '@/access';
import { PrismaService } from '@/prisma';

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
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await this.tokens.hashPassword(dto.password);

    let user: { id: string };
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
        },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'EMAIL_TAKEN' });
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
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
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

    const now = new Date();
    const tokens = await this.tokens.issueTokens(user.id, now);
    const session = await this.subjectFactory.loadSession(user.id, now.getTime());
    if (!session) {
      throw new UnauthorizedException({ code: 'SESSION_LOAD_FAILED' });
    }
    return { tokens, session };
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
