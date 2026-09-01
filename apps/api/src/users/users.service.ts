import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { TokenService } from '@/auth';
import { resolveNamePatch, resolveNames } from '@/common';
import { IdentityService } from '@/identity';
import { type OfficerRole, toClubRoles } from '@/memberships';
import { PrismaService } from '@/prisma';
import { StorageService } from '@/storage';

import type { DeleteAccountDto, UpdateProfileDto } from './dto/profile.dto';
import type { CreateUserDto, SetUserPasswordDto, UpdateUserDto } from './dto/users.dto';
import {
  type CreateUserResultWire,
  type MyHistoryEventWire,
  type MyHistoryWire,
  type ProfileWire,
  toProfileWire,
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
    private readonly storage: StorageService,
    private readonly identity: IdentityService,
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
    const items = await Promise.all(
      trimmed.map((row) =>
        toUserWire(row, row._count.memberships, row._count.orgAssignments, this.storage),
      ),
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
    return toUserWire(
      updated,
      updated._count.memberships,
      updated._count.orgAssignments,
      this.storage,
    );
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
    return toUserWire(
      updated,
      updated._count.memberships,
      updated._count.orgAssignments,
      this.storage,
    );
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

    const phone = dto.phone;
    const email = dto.email?.trim().toLowerCase() || null;
    const passwordHash = await this.tokens.hashPassword(dto.password);
    // Single `name` input or the legacy first/last pair — one must resolve.
    const names = resolveNames(dto);
    if (!names) {
      throw new BadRequestException({
        code: 'NAME_REQUIRED',
        message: 'Provide the full name',
      });
    }
    const { firstName, lastName } = names;
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
        // Claim the global identity for this number inside the same
        // transaction, so the roster row below is born linked.
        const person = await this.identity.claimPerson(created.id, tx);
        if (club) {
          await tx.membership.create({
            data: {
              clubId: club.id,
              userId: created.id,
              personId: person?.id ?? null,
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
        ...(await toUserWire(user, club ? 1 : 0, 0, this.storage)),
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
    const namePatch = resolveNamePatch(dto);
    if (namePatch.firstName !== undefined) data.firstName = namePatch.firstName;
    if (namePatch.lastName !== undefined) data.lastName = namePatch.lastName;
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase() || null;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.tiMemberNumber !== undefined) data.tiMemberNumber = dto.tiMemberNumber.trim() || null;

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        include: { _count: { select: { memberships: true, orgAssignments: true } } },
      });
      if (
        namePatch.firstName !== undefined ||
        namePatch.lastName !== undefined ||
        dto.email !== undefined ||
        dto.phone !== undefined
      ) {
        await this.identity.syncUserProfile(userId);
      }
      return toUserWire(
        updated,
        updated._count.memberships,
        updated._count.orgAssignments,
        this.storage,
      );
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

  /** Self-service read — the account holder's own view of themselves,
   * including bio/avatar/socials and a read-only pathway summary per club.
   * No permission check: `userId` always comes from `@CurrentUser()`, never
   * a param, so there's nothing to authorise beyond "is signed in". */
  async getProfile(userId: string): Promise<ProfileWire> {
    const row = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!row) throw new NotFoundException(`No user with id "${userId}"`);
    return toProfileWire(row, await this.loadProfileMemberships(userId), this.storage);
  }

  /** Self-service edit — same trust boundary as `AuthService.changePassword`:
   * `userId` comes from `@CurrentUser()`, so the account holder can only ever
   * touch their own row. `email`/`phone` double as contact/sign-in
   * credentials, so changing either requires re-confirming the current
   * password in the same request — everything else (name, bio, avatar,
   * socials) is a plain field edit. */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileWire> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`No user with id "${userId}"`);

    if (dto.email !== undefined || dto.phone !== undefined) {
      if (!dto.currentPassword) {
        throw new BadRequestException({ code: 'CURRENT_PASSWORD_REQUIRED' });
      }
      const currentOk = await this.tokens.verifyPassword(user.passwordHash, dto.currentPassword);
      if (!currentOk) {
        throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
      }
    }

    const data: Prisma.UserUpdateInput = {};
    const namePatch = resolveNamePatch(dto);
    if (namePatch.firstName !== undefined) data.firstName = namePatch.firstName;
    if (namePatch.lastName !== undefined) data.lastName = namePatch.lastName;
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase() || null;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.bio !== undefined) data.bio = dto.bio.trim() || null;
    if (dto.avatarUrl !== undefined) {
      // Avatars are user-scoped: the key must sit under this caller's own
      // `users/<id>/avatar/` prefix, so one member cannot point their row at
      // another member's object and have the API sign it for them.
      if (dto.avatarUrl) this.storage.assertOwnedKey(dto.avatarUrl, 'avatar', userId);
      data.avatarUrl = dto.avatarUrl || null;
      // Replacing an avatar orphans the old object; drop it once the write
      // below succeeds (see after the update).
    }
    if (dto.socials !== undefined) {
      data.socials = dto.socials.map((s) => ({ platform: s.platform, url: s.url.trim() }));
    }

    try {
      const updated = await this.prisma.user.update({ where: { id: userId }, data });
      // The account holder is the source of truth — one profile save
      // propagates to every club, roster and guest list (IDENTITY_PLAN §5).
      await this.identity.syncUserProfile(userId);
      if (dto.avatarUrl !== undefined && user.avatarUrl && user.avatarUrl !== updated.avatarUrl) {
        await this.storage.remove(user.avatarUrl);
      }
      return toProfileWire(updated, await this.loadProfileMemberships(userId), this.storage);
    } catch (err) {
      throw this.mapUniqueConflict(err);
    }
  }

  /** Self-service account deletion, as Google Play's data-deletion policy
   * requires of any app that lets people register.
   *
   * Deliberately NOT the same operation as `bulkDelete` above: that one is
   * the Super Admin removing *other* people and gates on `user:delete`,
   * which no club or org role grants. This one gates on nothing but a
   * re-typed password, because `userId` comes from `@CurrentUser()` and a
   * person needs no permission to stop being a user.
   *
   * What survives is the point. `Membership.userId` is `onDelete: SetNull`,
   * so their roster rows revert to unclaimed and every agenda, speech,
   * evaluation and attendance row — all keyed on `membershipId`, never
   * `userId` — is untouched. The club keeps its records the way it keeps its
   * minutes. Everything genuinely personal cascades: refresh tokens, push
   * subscriptions, org assignments, credential shares, invites they sent.
   *
   * The one thing cascade cannot do is the denormalised contact block on
   * `Membership`. Leaving it would make the deletion a lie — name, email and
   * phone still on file — and worse, `phone` is the claim key
   * (`WHERE phone = ? AND userId IS NULL`), so whoever is issued that number
   * next would silently claim the row and inherit a stranger's speech
   * history. Email and phone are cleared; the name stays, as a club record.
   */
  /** `GET /profile/history` (IDENTITY_PLAN §7a): the account holder's whole
   * cross-club story — everywhere their number has been, guest and member
   * eras unioned, one chronological feed. Club-private CRM stays out. */
  async getMyHistory(userId: string): Promise<MyHistoryWire> {
    const empty: MyHistoryWire = {
      events: [],
      stats: { clubsTouched: 0, meetingsAttended: 0, roles: 0, speeches: 0 },
    };
    const person = await this.prisma.person.findFirst({ where: { userId } });
    if (!person) return empty;

    const [memberships, prospects] = await Promise.all([
      this.prisma.membership.findMany({ where: { personId: person.id }, select: { id: true } }),
      this.prisma.prospect.findMany({ where: { personId: person.id }, select: { id: true } }),
    ]);
    const memberIds = memberships.map((m) => m.id);
    const guestIds = prospects.map((p) => p.id);
    if (memberIds.length === 0 && guestIds.length === 0) return empty;

    const meetingSelect = {
      id: true,
      theme: true,
      meetingNumber: true,
      dateTime: true,
      club: { select: { id: true, name: true } },
    } as const;
    const [memberAtt, guestAtt, roles, speeches] = await Promise.all([
      memberIds.length
        ? this.prisma.meetingAttendance.findMany({
            where: { membershipId: { in: memberIds }, present: true },
            select: { membershipId: true, meeting: { select: meetingSelect } },
          })
        : [],
      guestIds.length
        ? this.prisma.meetingGuestAttendance.findMany({
            where: { guestId: { in: guestIds }, present: true },
            select: { guestId: true, meeting: { select: meetingSelect } },
          })
        : [],
      this.prisma.meetingRoleAssignment.findMany({
        where: {
          OR: [{ membershipId: { in: memberIds } }, { guestId: { in: guestIds } }],
        },
        select: {
          roleKey: true,
          membershipId: true,
          guestId: true,
          meeting: { select: meetingSelect },
        },
      }),
      this.prisma.meetingSpeaker.findMany({
        where: {
          OR: [{ membershipId: { in: memberIds } }, { guestId: { in: guestIds } }],
        },
        select: {
          title: true,
          membershipId: true,
          guestId: true,
          meeting: { select: meetingSelect },
        },
      }),
    ]);

    const events: MyHistoryWire['events'] = [];
    const push = (
      m: {
        id: string;
        theme: string;
        meetingNumber: number;
        dateTime: Date;
        club: { id: string; name: string };
      },
      kind: MyHistoryEventWire['kind'],
      era: MyHistoryEventWire['era'],
      detail?: string,
    ) =>
      events.push({
        date: m.dateTime.toISOString(),
        meetingId: m.id,
        meetingLabel: m.theme ? `#${m.meetingNumber} · ${m.theme}` : `Meeting #${m.meetingNumber}`,
        clubId: m.club.id,
        clubName: m.club.name,
        kind,
        era,
        ...(detail ? { detail } : {}),
      });
    for (const r of memberAtt) push(r.meeting, 'visit', 'member');
    for (const r of guestAtt) push(r.meeting, 'visit', 'guest');
    for (const r of roles) push(r.meeting, 'role', r.membershipId ? 'member' : 'guest', r.roleKey);
    for (const r of speeches)
      push(r.meeting, 'speech', r.membershipId ? 'member' : 'guest', r.title || undefined);

    events.sort((a, b) => b.date.localeCompare(a.date));
    return {
      events,
      stats: {
        clubsTouched: new Set(events.map((e) => e.clubId)).size,
        meetingsAttended: memberAtt.length + guestAtt.length,
        roles: roles.length,
        speeches: speeches.length,
      },
    };
  }

  async deleteOwnAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, isSuperAdmin: true },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    }

    const passwordOk = await this.tokens.verifyPassword(user.passwordHash, dto.currentPassword);
    if (!passwordOk) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }

    await this.assertNotLastAdmin(user.id, user.isSuperAdmin);

    // Scrub before the delete, not after: `userId` is what identifies the
    // rows, and deleting the user nulls it.
    await this.prisma.$transaction([
      this.prisma.membership.updateMany({
        where: { userId },
        data: { email: null, phone: null },
      }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }

  /** Refuses a self-delete that would strand a club with nobody able to
   * administer it, or the platform with no Super Admin. Both are states only
   * an out-of-band fix can recover from, so they are worth blocking in front
   * of the user — who can hand the role over and come back — rather than
   * discovering later. */
  private async assertNotLastAdmin(userId: string, isSuperAdmin: boolean): Promise<void> {
    if (isSuperAdmin) {
      const remaining = await this.prisma.user.count({
        where: { isSuperAdmin: true, status: 'active', id: { not: userId } },
      });
      if (remaining === 0) {
        throw new BadRequestException({ code: 'LAST_SUPER_ADMIN' });
      }
    }

    const adminOf = await this.prisma.membership.findMany({
      where: { userId, isClubAdmin: true, status: 'active' },
      select: { id: true, clubId: true, club: { select: { name: true } } },
    });
    if (adminOf.length === 0) return;

    const covered = await this.prisma.membership.groupBy({
      by: ['clubId'],
      where: {
        clubId: { in: adminOf.map((m) => m.clubId) },
        id: { notIn: adminOf.map((m) => m.id) },
        isClubAdmin: true,
        status: 'active',
      },
      _count: { _all: true },
    });
    const stillAdministered = new Set(
      covered.filter((row) => row._count._all > 0).map((row) => row.clubId),
    );

    const orphaned = adminOf.filter((m) => !stillAdministered.has(m.clubId));
    if (orphaned.length > 0) {
      throw new BadRequestException({
        code: 'LAST_CLUB_ADMIN',
        clubs: orphaned.map((m) => m.club.name),
      });
    }
  }

  /** Read-only pathway summary for the profile screen — pathway/level stay
   * editable only through the Education module. */
  private async loadProfileMemberships(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'active' },
      select: { clubId: true, pathway: true, level: true, club: { select: { name: true } } },
    });
    return memberships.map((m) => ({
      clubId: m.clubId,
      clubName: m.club.name,
      pathway: m.pathway,
      level: m.level,
    }));
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
