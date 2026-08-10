import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';

import { PrismaService } from '@/prisma';

import type { SubscribePushDto } from './dto/push.dto';

export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  /** Deep link opened on notification click — see `notificationclick` in
   * public/sw.js. Defaults to `/` there if omitted. */
  url?: string;
}

/** Web Push subscribe/unsubscribe/send. Subscribe and unsubscribe are wired
 * to `PushController` today; `send()` has no caller yet — it's the pipeline
 * a future feature (meeting reminders, role assignments, …) calls into once
 * there's an actual event to notify on. Nothing here requires VAPID keys to
 * exist except `send()` itself, so subscribing works today even though
 * sending doesn't yet — see `.env.example` for how to generate them. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private vapidConfigured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT');
    if (publicKey && privateKey && subject) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.vapidConfigured = true;
    }
  }

  /** Upserts on `endpoint` — the same browser resubscribing (or a different
   * user signing into a device that already holds a stale subscription for
   * someone else) just reassigns the row rather than erroring on the unique
   * constraint. */
  async subscribe(userId: string, dto: SubscribePushDto): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
    });
  }

  /** Scoped to `userId` so one signed-in user can't unsubscribe another's
   * device by guessing an endpoint. Idempotent — deleting an
   * already-gone/foreign row is silently a no-op, same as the rest of the
   * app's delete endpoints. */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /** Sends to every device the user is subscribed on. A 404/410 response
   * means the browser revoked the subscription — the push service will
   * never accept it again, so the row is deleted rather than retried.
   * Every other failure is logged and skipped; one dead device shouldn't
   * stop the rest from receiving the notification. */
  async send(userId: string, payload: PushPayload): Promise<void> {
    if (!this.vapidConfigured) {
      this.logger.warn('send() called with no VAPID keys configured — skipping');
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            this.logger.warn(`Push send failed for subscription ${sub.id}: ${String(err)}`);
          }
        }
      }),
    );
  }
}
