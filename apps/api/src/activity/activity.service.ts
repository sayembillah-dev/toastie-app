import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { PrismaService } from '@/prisma';

import { type ActivityCategory, type ActivityLogWire, toActivityLogWire } from './serializers';

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

  async list(subject: PermissionSubject, clubId: string): Promise<ActivityLogWire[]> {
    if (!can(subject, 'read', 'activityLog', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'activityLog',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const rows = await this.prisma.activityLog.findMany({
      where: { clubId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toActivityLogWire);
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
