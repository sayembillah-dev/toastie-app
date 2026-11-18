import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma';

import { type NotificationPageWire, toNotificationWire } from './serializers';

const PAGE_SIZE = 20;

/** What a domain service passes to notify someone in the app. */
export interface NotificationInput {
  /** Recipient accounts. Duplicates are collapsed. */
  userIds: string[];
  clubId: string | null;
  /** Stable key for the kind of event, e.g. `meeting.role_assigned`. */
  type: string;
  title: string;
  body: string;
  /** Web path — see `Notification.link`. */
  link?: string | null;
  /** Flutter route — see `Notification.appRoute`. */
  appRoute?: string | null;
  entityType?: string;
  entityId?: string;
}

/** In-app notifications: the write side every domain service calls after its
 * change commits, and the read side behind `/notifications`.
 *
 * `notify()` is fire-and-forget like the WhatsApp/push sends next to it — a
 * failed insert is logged and never fails the request that caused it. It
 * doesn't depend on WhatsApp or push being configured. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  notify(input: NotificationInput): void {
    void this.create(input).catch((error: unknown) => {
      this.logger.error(
        `In-app notification "${input.type}" failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  /** Awaitable form of `notify()` for callers already inside async work. */
  async create(input: NotificationInput): Promise<void> {
    const userIds = [...new Set(input.userIds)];
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        clubId: input.clubId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        appRoute: input.appRoute ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      })),
    });
  }

  async list(
    userId: string,
    args: { cursor?: string; limit?: number; unread?: boolean } = {},
  ): Promise<NotificationPageWire> {
    const limit = Math.min(Math.max(args.limit ?? PAGE_SIZE, 1), 50);
    const where: Prisma.NotificationWhereInput = { userId };
    if (args.unread) where.readAt = null;
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      // A cursor from someone else's list simply matches nothing in `where`.
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const clubIds = [...new Set(page.map((r) => r.clubId).filter((id): id is string => !!id))];
    const clubs = clubIds.length
      ? await this.prisma.club.findMany({
          where: { id: { in: clubIds } },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(clubs.map((c) => [c.id, c.name]));
    return {
      items: page.map((row) =>
        toNotificationWire(row, row.clubId ? (names.get(row.clubId) ?? null) : null),
      ),
      nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** Scoped by `userId` too — someone else's id is a silent no-op. */
  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
