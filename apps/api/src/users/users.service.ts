import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { PrismaService } from '@/prisma';

import { toUserWire, USERS_PAGE_SIZE, type UsersPageWire, type UserWire } from './serializers';

/** Cross-tenant User management, reachable only via the Super Admin
 * bypass — no club/org role grants `user:*`, so the `can()` check falls
 * through to `superAdmin` in `decide()`. Every fine check here is
 * defensive; the coarse `@Requires('user', …)` on the controller
 * already gates it. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    subject: PermissionSubject,
    args: { search?: string; page?: number },
  ): Promise<UsersPageWire> {
    if (!can(subject, 'read', 'user')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'user',
        action: 'read',
      });
    }
    const page = Math.max(1, args.page ?? 1);
    const skip = (page - 1) * USERS_PAGE_SIZE;
    const needle = args.search?.trim();
    const where: Prisma.UserWhereInput = needle
      ? {
          OR: [
            { phone: { contains: needle, mode: 'insensitive' } },
            { email: { contains: needle, mode: 'insensitive' } },
            { firstName: { contains: needle, mode: 'insensitive' } },
            { lastName: { contains: needle, mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          _count: { select: { memberships: true, orgAssignments: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: USERS_PAGE_SIZE + 1,
      }),
      this.prisma.user.count({ where }),
    ]);
    const hasMore = rows.length > USERS_PAGE_SIZE;
    const trimmed = hasMore ? rows.slice(0, USERS_PAGE_SIZE) : rows;
    const items = trimmed.map((row) =>
      toUserWire(row, row._count.memberships, row._count.orgAssignments),
    );
    return { items, total, hasMore };
  }

  async setStatus(
    subject: PermissionSubject,
    actorUserId: string,
    userId: string,
    status: 'active' | 'suspended',
  ): Promise<UserWire> {
    if (!can(subject, 'update', 'user')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'user',
        action: 'update',
      });
    }
    // A Super Admin suspending themselves would lock everyone out of the
    // console — refuse loudly rather than let the mistake ship.
    if (userId === actorUserId && status === 'suspended') {
      throw new BadRequestException({ code: 'CANNOT_SUSPEND_SELF' });
    }
    await this.loadWithCounts(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      include: { _count: { select: { memberships: true, orgAssignments: true } } },
    });
    return toUserWire(updated, updated._count.memberships, updated._count.orgAssignments);
  }

  async setAdmin(
    subject: PermissionSubject,
    actorUserId: string,
    userId: string,
    isSuperAdmin: boolean,
  ): Promise<UserWire> {
    if (!can(subject, 'update', 'user')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'user',
        action: 'update',
      });
    }
    // Same self-lockout guard — a Super Admin can't demote themselves.
    // Removing the last admin entirely is also refused: at least one
    // account must retain the flag so someone can promote others back.
    if (userId === actorUserId && !isSuperAdmin) {
      throw new BadRequestException({ code: 'CANNOT_DEMOTE_SELF' });
    }
    if (!isSuperAdmin) {
      const otherAdmins = await this.prisma.user.count({
        where: { isSuperAdmin: true, status: 'active', id: { not: userId } },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException({ code: 'LAST_SUPER_ADMIN' });
      }
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isSuperAdmin },
      include: { _count: { select: { memberships: true, orgAssignments: true } } },
    });
    return toUserWire(updated, updated._count.memberships, updated._count.orgAssignments);
  }

  private async loadWithCounts(userId: string) {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { memberships: true, orgAssignments: true } } },
    });
    if (!row) throw new NotFoundException(`No user with id "${userId}"`);
    return row;
  }
}
