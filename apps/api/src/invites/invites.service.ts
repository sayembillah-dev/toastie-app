import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ClubRole as PrismaClubRole } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';
import { type MemberWire, toClubRoles, toMemberWire } from '@/memberships';
import { PrismaService } from '@/prisma';

import type { CreateInviteDto } from './dto/invites.dto';
import { type InviteWire, toInviteWire } from './serializers';

const INVITE_TTL_DAYS = 30;

/** Handles `/invites` — the pending-invite tracker a Club Admin (or VP
 * Membership, who has `invite:create`+`invite:read`) uses to record and
 * later close-the-loop when a person joins.
 *
 * Two flows write the roster:
 *   - `convertToMember(inviteId)`   — the admin's manual "mark as joined"
 *     button on the members tab. Creates an unclaimed Membership and marks
 *     the invite accepted, matching the current web behaviour.
 *   - (S13) accept-by-token — an authed signup claims the placeholder or
 *     creates a new Membership atomically.
 */
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
    const email = dto.email.trim().toLowerCase();
    const roles: PrismaClubRole[] = dto.roles && dto.roles.length > 0 ? toClubRoles(dto.roles) : [];

    // The raw token would be part of the emailed link (S13 introduces the
    // accept-by-token endpoint that reads it). For now the token is minted
    // and its hash stored so the DB shape matches the plan; the admin's
    // manual convert flow doesn't consume it.
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

    try {
      const row = await this.prisma.invite.create({
        data: {
          clubId,
          email,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          roles,
          status: 'pending',
          tokenHash,
          invitedByUserId: userId,
          expiresAt,
        },
      });
      const invitedByMembershipId = await this.membershipIdFor(clubId, userId);
      return toInviteWire(row, invitedByMembershipId ?? '');
    } catch (err) {
      // The partial index `invite_one_pending_per_club_email` collapses
      // double-clicks — surface it as a 409 rather than a 500 so the modal
      // can retry cleanly.
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

  /** Admin's manual "mark as joined" — creates an unclaimed Membership and
   * marks the invite accepted in one transaction so a mid-flight failure
   * can't produce a member without closing the invite (or vice versa). */
  async convertToMember(subject: PermissionSubject, inviteId: string): Promise<MemberWire> {
    const existing = await this.load(inviteId);
    if (!can(subject, 'update', 'invite', { clubId: existing.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'invite',
        action: 'update',
        reason: 'You do not manage this club',
      });
    }
    if (existing.status !== 'pending') {
      throw new BadRequestException({
        code: 'INVITE_NOT_PENDING',
        message: 'Only a pending invite can be converted',
      });
    }

    const now = new Date();
    const roles: PrismaClubRole[] =
      existing.roles.length > 0 ? existing.roles : ['Member' as PrismaClubRole];

    const [, membership] = await this.prisma.$transaction([
      this.prisma.invite.update({
        where: { id: inviteId },
        data: { status: 'accepted', acceptedAt: now },
      }),
      this.prisma.membership.create({
        data: {
          clubId: existing.clubId,
          firstName: existing.firstName ?? existing.email.split('@')[0] ?? existing.email,
          lastName: existing.lastName ?? '',
          email: existing.email,
          roles,
          isClubAdmin: false,
          status: 'active',
          grantOverrides: {},
        },
      }),
    ]);
    return toMemberWire(membership);
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
