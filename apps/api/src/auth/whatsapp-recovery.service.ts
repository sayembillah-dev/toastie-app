import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import { SubjectFactory } from '@/access';
import { PrismaService } from '@/prisma';
import { WhatsappService } from '@/whatsapp';

import type { AuthResult } from './auth.service';
import type { WhatsappRecoveryResetDto } from './dto/whatsapp-recovery.dto';
import { OTP_TTL_MINUTES, OtpService } from './otp.service';
import { TokenService } from './token.service';

/** Recovery messages the whole system may send per hour, across every phone.
 * Each one spends the reputation of the one real SIM behind the WhatsApp
 * worker, and an unofficial client gets banned for volume — so a burst of
 * requests (for example, someone walking a list of numbers) stops here, even
 * though every single phone is still under its own 3-per-day limit. */
const MAX_RECOVERY_MESSAGES_PER_HOUR = 30;

const BRAND = 'Openfloor';

/** Password recovery over WhatsApp, for accounts that cannot use the email
 * reset because they have no verified email yet:
 *
 *   1. `requestCode(phone)` — answers at once and works in the background, so
 *      the response is the same, in content AND timing, for every number.
 *   2. `reset(dto)` — checks the code, sets the new password, signs out every
 *      device, and signs this device in. The email gate then asks for an
 *      email, so the account can use the email reset next time.
 *
 * Who can use it: active accounts with NO verified email, and never a Super
 * Admin (a phone number is weaker proof than an inbox, and a Super Admin
 * account is worth the most to an attacker). Everyone else uses the email
 * reset, or asks an admin. */
@Injectable()
export class WhatsappRecoveryService {
  private readonly logger = new Logger(WhatsappRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly whatsapp: WhatsappService,
    private readonly subjectFactory: SubjectFactory,
  ) {}

  /** Never throws and never waits on the database or WhatsApp. */
  requestCode(phone: string): void {
    void this.sendCode(phone).catch((err: unknown) => {
      this.logger.error(
        `WhatsApp recovery code for ${maskPhone(phone)} failed: ${(err as Error).message ?? String(err)}`,
      );
    });
  }

  async reset(dto: WhatsappRecoveryResetDto): Promise<AuthResult> {
    const now = new Date();
    const verified = await this.otp.verify(
      { channel: 'whatsapp', target: dto.phone, purpose: 'whatsapp_recovery', code: dto.code },
      now,
    );
    if (!verified.ok || !verified.userId) throw invalidCode();

    // Re-check everything: since the code went out, the account may have
    // verified an email, been suspended, become a Super Admin, or the number
    // may have moved to another account.
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true, status: true, isSuperAdmin: true, emailVerifiedAt: true },
    });
    if (!user || user.id !== verified.userId || !isEligible(user)) throw invalidCode();

    const passwordHash = await this.tokens.hashPassword(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      // Every device: whoever knew the old password must be out.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      // An admin's credential handoff carries the old password — useless now.
      this.prisma.credentialShare.deleteMany({ where: { userId: user.id } }),
    ]);

    void this.whatsapp
      .sendText(
        dto.phone,
        `The password of your ${BRAND} account was just changed, and every other device was signed out. If you did not do this, tell your club officer now.`,
      )
      .catch((err: unknown) =>
        this.logger.error(
          `"Password changed" WhatsApp notice to ${maskPhone(dto.phone)} failed: ${(err as Error).message ?? String(err)}`,
        ),
      );

    const tokens = await this.tokens.issueTokens(user.id, now);
    const session = await this.subjectFactory.loadSession(user.id, now.getTime());
    if (!session) throw new UnauthorizedException({ code: 'SESSION_LOAD_FAILED' });
    return { tokens, session };
  }

  private async sendCode(phone: string): Promise<void> {
    // WhatsApp off on this server: nothing could be delivered, so do not
    // create a code that would count against the person's daily limit.
    if (!this.whatsapp.isConfigured) {
      this.logger.warn(`WhatsApp recovery for ${maskPhone(phone)} skipped: WhatsApp is off`);
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, status: true, isSuperAdmin: true, emailVerifiedAt: true },
    });
    if (!user || !isEligible(user)) return;

    const now = new Date();
    const sentLastHour = await this.prisma.otpCode.count({
      where: {
        purpose: 'whatsapp_recovery',
        createdAt: { gt: new Date(now.getTime() - 60 * 60_000) },
      },
    });
    if (sentLastHour >= MAX_RECOVERY_MESSAGES_PER_HOUR) {
      this.logger.warn(
        `WhatsApp recovery for ${maskPhone(phone)} not sent: system limit of ${MAX_RECOVERY_MESSAGES_PER_HOUR}/hour reached`,
      );
      return;
    }

    const issued = await this.otp.issue(
      { channel: 'whatsapp', target: phone, purpose: 'whatsapp_recovery', userId: user.id },
      now,
    );
    if (!issued.ok) {
      this.logger.warn(`WhatsApp recovery for ${maskPhone(phone)} not sent: ${issued.reason}`);
      return;
    }

    const text = `Your ${BRAND} account recovery code is ${issued.code}. It expires in ${OTP_TTL_MINUTES} minutes. Do not share this code with anyone. If you did not ask for it, ignore this message.`;
    let status: 'sent' | 'not-on-whatsapp' | 'skipped' | 'failed' = 'failed';
    try {
      status = (await this.whatsapp.sendText(phone, text)).status;
    } finally {
      if (status !== 'sent') {
        const thisCode = {
          target: phone,
          purpose: 'whatsapp_recovery' as const,
          userId: user.id,
          createdAt: { gte: now },
          consumedAt: null,
        };
        if (status === 'not-on-whatsapp') {
          // WhatsApp was asked about this number, so the request still
          // counts towards the limits — otherwise a number with no WhatsApp
          // could be checked again and again, and heavy number checks put
          // the SIM at risk. Kill the code but keep the row.
          await this.prisma.otpCode.updateMany({ where: thisCode, data: { expiresAt: now } });
        } else {
          // Nothing reached WhatsApp (worker down or off): remove the code,
          // so a failure on our side does not use up one of the person's
          // three codes for the day.
          await this.prisma.otpCode.deleteMany({ where: thisCode });
        }
        this.logger.warn(`WhatsApp recovery code for ${maskPhone(phone)} not delivered: ${status}`);
      }
    }
  }
}

function isEligible(user: {
  status: string;
  isSuperAdmin: boolean;
  emailVerifiedAt: Date | null;
}): boolean {
  return user.status === 'active' && !user.isSuperAdmin && user.emailVerifiedAt === null;
}

/** One error for every way a recovery can fail, so the response never tells
 * an attacker whether the number has an account or which check failed. */
function invalidCode(): BadRequestException {
  return new BadRequestException({
    code: 'OTP_INVALID',
    message: 'The code is wrong or has expired. Ask for a new code.',
  });
}

/** `01712345678` → `017•••••678`. For logs only. */
function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 3)}•••••${phone.slice(-3)}` : '•••';
}
