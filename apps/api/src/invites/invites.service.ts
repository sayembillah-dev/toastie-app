import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ClubRole as PrismaClubRole } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';
import { toClubRoles, toOfficerRoles } from '@/memberships';
import { PrismaService } from '@/prisma';

import type { CreateInviteDto } from './dto/invites.dto';
import { type InvitePreview, type InviteWire, toInviteWire } from './serializers';

const INVITE_TTL_DAYS = 30;

/** Handles `/invites` — a Club Admin (or VP Membership, who has
 * `invite:create`+`invite:read`) generates a role-scoped join link, tracks
 * who's still mid-invite, and can revoke or re-share it. The link itself is
 * consumed by `acceptByToken`/`previewByToken`, called from the public
 * `/invite/:token` pages once the invitee signs in or signs up. */
@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(subject: PermissionSubject, clubId: string): Promise<InviteWire[]> {
    if (!can(subject, 'read', 'invite', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'invite',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const rows = await this.prisma.invite.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
    });
    const membershipsByUser = await this.membershipIndex(
      clubId,
      rows.map((r) => r.invitedByUserId),
    );
    return rows.map((row) => toInviteWire(row, membershipsByUser.get(row.invitedByUserId) ?? ''));
  }

  async create(
    subject: PermissionSubject,
    clubId: string,
    userId: string,
    dto: CreateInviteDto,
  ): Promise<InviteWire> {
    if (!can(subject, 'create', 'invite', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'invite',
        action: 'create',
        reason: 'You do not manage this club',
      });
    }
    const email = dto.email?.trim().toLowerCase() || null;
    const inviteeName = dto.inviteeName.trim();
    const roles: PrismaClubRole[] = toClubRoles(dto.roles);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

    try {
      const row = await this.prisma.invite.create({
        data: {
          clubId,
          email,
          inviteeName,
          roles,
          status: 'pending',
          token,
          invitedByUserId: userId,
          expiresAt,
        },
      });
      const invitedByMembershipId = await this.membershipIdFor(clubId, userId);
      return toInviteWire(row, invitedByMembershipId ?? '');
    } catch (err) {
      // The partial index `invite_one_pending_per_club_email` collapses
      // double-clicks for the legacy email-addressed path — surface it as a
      // 409 rather than a 500. Link invites (no email) never hit this.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'INVITE_ALREADY_PENDING',
          message: 'There is already a pending invite for this email in this club',
        });
      }
      throw err;
    }
  }

  async revoke(subject: PermissionSubject, inviteId: string): Promise<InviteWire> {
    const existing = await this.load(inviteId);
    if (!can(subject, 'delete', 'invite', { clubId: existing.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'invite',
        action: 'delete',
        reason: 'You do not manage this club',
      });
    }
    if (existing.status !== 'pending') {
      throw new BadRequestException({
        code: 'INVITE_NOT_PENDING',
        message: 'Only a pending invite can be revoked',
      });
    }
    const now = new Date();
    const updated = await this.prisma.invite.update({
      where: { id: inviteId },
      data: { status: 'revoked', revokedAt: now },
    });
    const invitedByMembershipId = await this.membershipIdFor(
      existing.clubId,
      existing.invitedByUserId,
    );
    return toInviteWire(updated, invitedByMembershipId ?? '');
  }

  /** Public preview for `/invite/:token` — no auth, no permission check.
   * Tells the landing page whether the link is still good and, if so, which
   * club and role(s) it grants, before asking the visitor to sign in. */
  async previewByToken(token: string): Promise<InvitePreview> {
    const row = await this.prisma.invite.findUnique({
      where: { token },
      include: { club: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException('No invite matches that link');

    return {
      state: this.stateOf(row),
      clubName: row.club.name,
      roles: toOfficerRoles(row.roles),
    };
  }

  /** An authed signup/login claims the link — creates the Membership from
   * the *caller's* identity (not the invite's, which no longer carries one)
   * and the invite's roles, atomically with closing the invite out. Mirrors
   * `JoinRequestsService.approve`. */
  async acceptByToken(
    userId: string,
    token: string,
  ): Promise<{ clubId: string; clubName: string }> {
    const row = await this.prisma.invite.findUnique({
      where: { token },
      include: { club: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException('No invite matches that link');

    const state = this.stateOf(row);
    if (state === 'expired') {
      throw new BadRequestException({ code: 'INVITE_EXPIRED', message: 'This invite has expired' });
    }
    if (state === 'accepted') {
      throw new BadRequestException({
        code: 'INVITE_ALREADY_USED',
        message: 'This invite has already been used',
      });
    }
    if (state === 'revoked') {
      throw new BadRequestException({
        code: 'INVITE_REVOKED',
        message: 'This invite has been revoked',
      });
    }

    const existingMembership = await this.prisma.membership.findFirst({
      where: { clubId: row.clubId, userId, status: 'active' },
      select: { id: true },
    });
    if (existingMembership) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'You are already a member of this club',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!user) throw new NotFoundException(`No user with id "${userId}"`);

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.invite.update({
        where: { id: row.id },
        data: { status: 'accepted', acceptedAt: now },
      }),
      this.prisma.membership.create({
        data: {
          clubId: row.clubId,
          userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles: row.roles,
          isClubAdmin: false,
          status: 'active',
          grantOverrides: {},
        },
      }),
    ]);

    return { clubId: row.clubId, clubName: row.club.name };
  }

  private stateOf(row: {
    status: string;
    expiresAt: Date;
  }): 'valid' | 'expired' | 'accepted' | 'revoked' {
    if (row.status === 'accepted') return 'accepted';
    if (row.status === 'revoked') return 'revoked';
    if (row.expiresAt.getTime() < Date.now()) return 'expired';
    return 'valid';
  }

  private async load(inviteId: string) {
    const row = await this.prisma.invite.findUnique({ where: { id: inviteId } });
    if (!row) throw new NotFoundException(`No invite with id "${inviteId}"`);
    return row;
  }

  /** Batch-resolves `userId → active membership id` for a club. `invitedBy`
   * on the wire is a membership id (matches the frontend's expectation of
   * "invited by <member>"), so we look it up alongside the list query. */
  private async membershipIndex(clubId: string, userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds.filter((x) => x))];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.membership.findMany({
      where: { clubId, userId: { in: unique } },
      select: { id: true, userId: true },
    });
    const out = new Map<string, string>();
    for (const row of rows) {
      if (row.userId) out.set(row.userId, row.id);
    }
    return out;
  }

  private async membershipIdFor(clubId: string, userId: string): Promise<string | null> {
    const row = await this.prisma.membership.findFirst({
      where: { clubId, userId },
      select: { id: true },
    });
    return row?.id ?? null;
  }
}
