import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

import { PrismaService } from '@/prisma';

import type { DevicePlatform } from './dto/devices.dto';

export interface NativePushMessage {
  title: string;
  body: string;
  /** String-only data the app reads on tap, e.g. `{ route: '/meetings/abc' }`. */
  data?: Record<string, string>;
}

/* FCM error codes that mean the token is dead for good — the install was
 * removed or the token rotated — so it's deleted rather than retried. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** Device registration and sends for the Flutter app, through Firebase Cloud
 * Messaging (Android directly, iOS via APNs). Without
 * `FIREBASE_SERVICE_ACCOUNT` registration still works and `send()` no-ops,
 * the same way Web Push behaves without VAPID keys. */
@Injectable()
export class NativePushService {
  private readonly logger = new Logger(NativePushService.name);
  private readonly app: App | null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.app = initFirebase(config.get<string>('FIREBASE_SERVICE_ACCOUNT'), this.logger);
  }

  get isConfigured(): boolean {
    return this.app !== null;
  }

  /** Upserts by token: a token re-registered after a different person signs
   * in on the same phone moves to them. */
  async register(userId: string, platform: DevicePlatform, token: string): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, platform, token },
      update: { userId, platform, lastSeenAt: new Date() },
    });
  }

  /** Only removes the caller's own token — sign-out on that phone. */
  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
  }

  /** Sends to every registered install of each user. Never throws. */
  async send(userIds: string[], message: NativePushMessage): Promise<void> {
    if (!this.app || userIds.length === 0) return;
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: { in: [...new Set(userIds)] } },
      select: { token: true },
    });
    if (devices.length === 0) return;
    const tokens = devices.map((d) => d.token);
    try {
      const res = await getMessaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title: message.title, body: message.body },
        data: message.data,
        apns: { payload: { aps: { sound: 'default' } } },
        android: { priority: 'high', notification: { channelId: 'meetings' } },
      });
      const dead = res.responses
        .map((r, i) =>
          !r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code) ? tokens[i] : null,
        )
        .filter((t): t is string => t !== null);
      if (dead.length) await this.prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
      if (res.failureCount > dead.length) {
        this.logger.warn(
          `Native push: ${res.failureCount - dead.length} of ${tokens.length} sends failed`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Native push failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function initFirebase(raw: string | undefined, logger: Logger): App | null {
  if (!raw?.trim()) return null;
  try {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const account = JSON.parse(json) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return initializeApp(
      {
        credential: cert({
          projectId: account.project_id,
          clientEmail: account.client_email,
          privateKey: account.private_key,
        }),
      },
      'toastie-native-push',
    );
  } catch (error) {
    logger.error(
      `FIREBASE_SERVICE_ACCOUNT is set but unusable — native push is off: ${String(error)}`,
    );
    return null;
  }
}
