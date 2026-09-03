import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { PrismaService } from '@/prisma';

import { type ActivityCategory, type ActivityLogPageWire, toActivityLogWire } from './serializers';

/** Default page size for the feed — small enough to stay fast on a phone
 * connection, big enough that a busy day usually fits in one page. */
const ACTIVITY_LOGS_PAGE_SIZE = 50;

/** Shape callers pass in to log an event. `clubId` and `actorMembershipId`
 * are set by the caller (usually the service that just committed a write). */
export interface RecordActivityInput {
  clubId: string;
  actorMembershipId: string | null;
  category: ActivityCategory;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
}

/** Handles `/activity-logs` and the write-side `recordActivity()` helper
 * every domain service calls to keep the audit stream honest.
 *
 * Read-side is gated by `activityLog:read` (Club Admins and officers with
 * an explicit grant, per `ROLE_GRANTS` in `@toastly/access`). Write-side
 * has no permission check — a domain service has already authorised the
 * mutation, and the log is derived from that write. */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Filters behind `GET /activity-logs`. `since` arrives as an instant the
   * client computed from its own clock (viewer-local "today"). */
  async list(
    subject: PermissionSubject,
    clubId: string,
    args: {
      cursor?: string;
      limit?: number;
      memberId?: string;
      category?: string;
      since?: string;
      q?: string;
    } = {},
  ): Promise<ActivityLogPageWire> {
    if (!can(subject, 'read', 'activityLog', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'activityLog',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }

    const limit = Math.min(Math.max(args.limit ?? ACTIVITY_LOGS_PAGE_SIZE, 1), 100);
    const needle = args.q?.trim();

    const where: Prisma.ActivityLogWhereInput = { clubId };
    if (args.memberId) where.actorMembershipId = args.memberId;
    if (args.category) where.category = args.category;
    if (args.since) where.createdAt = { gte: new Date(args.since) };

    if (needle) {
      /* Actor-name search is a two-step lookup rather than a relation filter:
       * `actorMembershipId` is a bare column (no FK), and adding the FK now
       * would make any legacy row with a dangling id unmigrateable. Rosters
       * are small, so the extra round-trip is cheap. Each token must appear
       * in the first or last name, so "aisha patel" matches too. */
      const tokens = needle.split(/\s+/).filter(Boolean);
      const actors = await this.prisma.membership.findMany({
        where: {
          clubId,
          AND: tokens.map((token) => ({
            OR: [
              { firstName: { contains: token, mode: 'insensitive' } },
              { lastName: { contains: token, mode: 'insensitive' } },
            ],
          })),
        },
        select: { id: true },
      });
      where.OR = [
        { summary: { contains: needle, mode: 'insensitive' } },
        { actorMembershipId: { in: actors.map((actor) => actor.id) } },
      ];
    }

    const rows = await this.prisma.activityLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      /* One extra row tells us whether another page exists without a
       * COUNT(*) over the whole log. */
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map(toActivityLogWire),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /** Called by domain services from inside their own `$transaction`. Pass
   * `tx` to make the log write ride the same commit as the mutation — a
   * failed transaction rolls the log back too, keeping the audit stream
   * from claiming events that never happened. Falls back to
   * `PrismaService` when no `tx` is provided (the fire-and-forget shape
   * the local-db used). */
  async record(entry: RecordActivityInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = (tx ?? this.prisma) as PrismaClient | Prisma.TransactionClient;
    await client.activityLog.create({
      data: {
        clubId: entry.clubId,
        actorMembershipId: entry.actorMembershipId,
        category: entry.category,
        action: entry.action,
        summary: entry.summary,
        entityType: entry.entityType,
        entityId: entry.entityId,
        points: 0,
      },
    });
  }
}
