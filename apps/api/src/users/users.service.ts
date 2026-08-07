import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { TokenService } from '@/auth';
import { type OfficerRole, toClubRoles } from '@/memberships';
import { PrismaService } from '@/prisma';

import type { CreateUserDto, SetUserPasswordDto, UpdateUserDto } from './dto/users.dto';
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
    args: { search?: string; page?: number; pageSize?: number },
  ): Promise<UsersPageWire> {
    if (!can(subject, 'read', 'user')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'user',
        action: 'read',
      });
    }
    const page = Math.max(1, args.page ?? 1);
    const pageSize = args.pageSize ?? USERS_PAGE_SIZE;
    const skip = (page - 1) * pageSize;
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
        take: pageSize + 1,
      }),
      this.prisma.user.count({ where }),
    ]);
    const hasMore = rows.length > pageSize;
    const trimmed = hasMore ? rows.slice(0, pageSize) : rows;
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
    const tiMemberNumber = dto.tiMemberNumber?.trim() || null;

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
    const memberType = club ? (dto.memberType ?? null) : null;

    const credentialShareToken = createId();

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            phone,
            email,
            passwordHash,
            firstName,
            lastName,
            tiMemberNumber,
            status: 'active',
            // The SA is choosing this password on the user's behalf — nudge
            // them to pick their own the first time they sign in.
            mustChangePassword: true,
          },
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
              memberType,
              status: 'active',
              grantOverrides: {},
            },
          });
        }
        // Snapshot rather than a join back to `User` — the handoff page
        // should keep showing what was created even if the profile is
        // edited afterward, and it means the public lookup never touches
        // the `User` row directly.
        await tx.credentialShare.create({
          data: {
            userId: created.id,
            token: credentialShareToken,
            firstName,
            lastName,
            phone,
            password: dto.password,
          },
        });
        return created;
      });

      return {
        ...toUserWire(user, club ? 1 : 0, 0),
        clubId: club?.id ?? null,
        clubName: club?.name ?? null,
        roles: club ? roles : [],
        isClubAdmin: club ? isClubAdmin : false,
        memberType,
        credentialShare: { token: credentialShareToken },
      };
    } catch (err) {
      throw this.mapUniqueConflict(err);
    }
  }

  /** Profile-field edit from the Super Admin's user detail panel. Every
   * field on `dto` is optional — only what's present gets written. */
  async update(subject: PermissionSubject, userId: string, dto: UpdateUserDto): Promise<UserWire> {
    if (!can(subject, 'update', 'user')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'user',
        action: 'update',
      });
    }
    await this.loadWithCounts(userId);

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase() || null;
    if (dto.phone !== undefined) data.phone = normalisePhone(dto.phone);
    if (dto.tiMemberNumber !== undefined) data.tiMemberNumber = dto.tiMemberNumber.trim() || null;

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        include: { _count: { select: { memberships: true, orgAssignments: true } } },
      });
      return toUserWire(updated, updated._count.memberships, updated._count.orgAssignments);
    } catch (err) {
      throw this.mapUniqueConflict(err);
    }
  }

  /** Admin-driven password reset — hashes the SA-supplied password and, since
   * this is someone else setting the credential rather than the account
   * holder rotating their own, revokes every active refresh token so a
   * session started under the old password can't keep running. */
  async setPassword(
    subject: PermissionSubject,
    userId: string,
    dto: SetUserPasswordDto,
  ): Promise<void> {
    if (!can(subject, 'update', 'user')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'user',
        action: 'update',
      });
    }
    await this.loadWithCounts(userId);
    const passwordHash = await this.tokens.hashPassword(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /** Permanent, irreversible delete — no soft-delete, no undo, unlike
   * `setStatus`'s suspend. `Membership` rows survive (the FK is
   * `onDelete: SetNull`): a club's roster and history shouldn't vanish
   * because the platform account tied to it was removed. Everything
   * account-scoped (refresh tokens, org assignments, invites sent, join
   * requests) cascades with it. */
  async bulkDelete(
    subject: PermissionSubject,
    actorUserId: string,
    userIds: string[],
  ): Promise<{ deletedCount: number }> {
    if (!can(subject, 'delete', 'user')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'user',
        action: 'delete',
      });
    }

    const ids = [...new Set(userIds)];
    if (ids.includes(actorUserId)) {
      throw new BadRequestException({ code: 'CANNOT_DELETE_SELF' });
    }

    const targets = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, isSuperAdmin: true },
    });
    if (targets.length === 0) {
      throw new NotFoundException('No matching users found');
    }

    const deletingAnAdmin = targets.some((t) => t.isSuperAdmin);
    if (deletingAnAdmin) {
      const remainingAdmins = await this.prisma.user.count({
        where: { isSuperAdmin: true, status: 'active', id: { notIn: ids } },
      });
      if (remainingAdmins === 0) {
        throw new BadRequestException({ code: 'LAST_SUPER_ADMIN' });
      }
    }

    const { count } = await this.prisma.user.deleteMany({
      where: { id: { in: targets.map((t) => t.id) } },
    });
    return { deletedCount: count };
  }

  /** Bare identity fields for a user — used by `UserMembershipsController`
   * to denormalise `firstName`/`lastName`/`email` onto a new `Membership`
   * row the same way `create()` above does at account-creation time. */
  async getBasic(
    userId: string,
  ): Promise<{ id: string; firstName: string; lastName: string; email: string | null }> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!row) throw new NotFoundException(`No user with id "${userId}"`);
    return row;
  }

  private async loadWithCounts(userId: string) {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { memberships: true, orgAssignments: true } } },
    });
    if (!row) throw new NotFoundException(`No user with id "${userId}"`);
    return row;
  }

  /** Shared by `create()` and `update()` — both write `phone`/`email`,
   * both need the same unique-constraint-violation-to-error-code mapping. */
  private mapUniqueConflict(err: unknown): Error {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = err.meta?.target;
      const takenField = Array.isArray(target)
        ? target.find((t) => t === 'email' || t === 'phone')
        : typeof target === 'string' && (target === 'email' || target === 'phone')
          ? target
          : undefined;
      return new ConflictException({
        code: takenField === 'email' ? 'EMAIL_TAKEN' : 'PHONE_TAKEN',
      });
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}

/** Strip user-friendly whitespace and dashes before hitting the DB. Keeps
 * the leading `+` (E.164 marker). Mirrors `AuthService`'s normalisation
 * so a phone typed here and one typed at self-registration end up in the
 * same canonical shape. */
function normalisePhone(raw: string): string {
  return raw.trim().replace(/[\s-]/g, '');
}
