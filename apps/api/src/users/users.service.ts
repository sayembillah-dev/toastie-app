import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { TokenService } from '@/auth';
import { type OfficerRole, toClubRoles } from '@/memberships';
import { PrismaService } from '@/prisma';

import type { CreateUserDto } from './dto/users.dto';
import {
  type CreateUserResultWire,
  toUserWire,
  USERS_PAGE_SIZE,
  type UsersPageWire,
  type UserWire,
} from './serializers';

/** Cross-tenant User management, reachable only via the Super Admin
 * bypass — no club/org role grants `user:*`, so the `can()` check falls
 * through to `superAdmin` in `decide()`. Every fine check here is
 * defensive; the coarse `@Requires('user', …)` on the controller
 * already gates it. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

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

  /** Super Admin's direct-provision flow: creates the `User` row and,
   * when `clubId` is given, a `Membership` already claimed by that user
   * — no separate accept-invite step, since the SA is vouching for the
   * account directly. Both writes are one transaction so a failure
   * partway through can't leave an unclaimed User with no membership
   * when one was requested. */
  async create(subject: PermissionSubject, dto: CreateUserDto): Promise<CreateUserResultWire> {
    if (!can(subject, 'create', 'user')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'user',
        action: 'create',
      });
    }

    const phone = normalisePhone(dto.phone);
    const email = dto.email?.trim().toLowerCase() || null;
    const passwordHash = await this.tokens.hashPassword(dto.password);
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    let club: { id: string; name: string } | null = null;
    if (dto.clubId) {
      club = await this.prisma.club.findUnique({
        where: { id: dto.clubId },
        select: { id: true, name: true },
      });
      if (!club) throw new NotFoundException(`No club with id "${dto.clubId}"`);
    }

    const roles: OfficerRole[] = dto.roles && dto.roles.length > 0 ? dto.roles : ['Member'];
    const isClubAdmin = dto.isClubAdmin ?? false;

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { phone, email, passwordHash, firstName, lastName, status: 'active' },
        });
        if (club) {
          await tx.membership.create({
            data: {
              clubId: club.id,
              userId: created.id,
              firstName,
              lastName,
              email,
              roles: toClubRoles(roles),
              isClubAdmin,
              status: 'active',
              grantOverrides: {},
            },
          });
        }
        return created;
      });

      return {
        ...toUserWire(user, club ? 1 : 0, 0),
        clubId: club?.id ?? null,
        clubName: club?.name ?? null,
        roles: club ? roles : [],
        isClubAdmin: club ? isClubAdmin : false,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
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

/** Strip user-friendly whitespace and dashes before hitting the DB. Keeps
 * the leading `+` (E.164 marker). Mirrors `AuthService`'s normalisation
 * so a phone typed here and one typed at self-registration end up in the
 * same canonical shape. */
function normalisePhone(raw: string): string {
  return raw.trim().replace(/[\s-]/g, '');
}
