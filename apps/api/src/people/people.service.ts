import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, ClubRole as PrismaClubRole, Prospect } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';
import { type MemberWire, toClubRoles, toMemberWire } from '@/memberships';
import { PrismaService } from '@/prisma';

import type { ConvertGuestDto, CreateGuestDto, UpdateGuestDto } from './dto/guests.dto';
import type {
  CreateContactLogDto,
  CreateVisitLogDto,
  UpdateContactLogDto,
  UpdateVisitLogDto,
} from './dto/logs.dto';
import {
  type ContactLogWire,
  type GuestWire,
  toContactLogWire,
  toGuestWire,
  toVisitLogWire,
  type VisitLogWire,
} from './serializers';
import { syncGuestVisitStats } from './visit-stats';

/** Handles `/guests` and its nested contact/visit log surfaces. The DB
 * model is `Prospect` — the local-db rename kept the wire calling it
 * "Guest" so this service translates at the boundary. */
@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  /** ------------------------------------------------------------ guests -- */

  async listGuests(subject: PermissionSubject, clubId: string): Promise<GuestWire[]> {
    if (!can(subject, 'read', 'guest', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'guest',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const rows = await this.prisma.prospect.findMany({
      where: { clubId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return rows.map(toGuestWire);
  }

  async getGuest(subject: PermissionSubject, guestId: string): Promise<GuestWire> {
    const row = await this.loadGuest(guestId);
    this.assertGuest(subject, row, 'read');
    return toGuestWire(row);
  }

  /** The only place a guest is created — meeting attendance and meeting-role
   * pickers only ever link to an existing `Prospect`, never mint one. */
  async createGuest(
    subject: PermissionSubject,
    clubId: string,
    dto: CreateGuestDto,
  ): Promise<GuestWire> {
    if (!can(subject, 'create', 'guest', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'guest',
        action: 'create',
        reason: 'You do not manage this club',
      });
    }
    const row = await this.prisma.prospect.create({
      data: {
        clubId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        whatsapp: dto.whatsapp?.trim() || null,
        avatarUrl: dto.avatarUrl || null,
        socials: (dto.socials ?? []) as unknown as Prisma.InputJsonValue,
        bio: dto.bio?.trim() || null,
        notes: dto.notes?.trim() || null,
        invitedBy: dto.invitedBy?.trim() || null,
        stage: 'new',
      },
    });
    return toGuestWire(row);
  }

  async updateGuest(
    subject: PermissionSubject,
    guestId: string,
    dto: UpdateGuestDto,
  ): Promise<GuestWire> {
    const existing = await this.loadGuest(guestId);
    this.assertGuest(subject, existing, 'update');

    const data: Prisma.ProspectUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.email !== undefined) data.email = dto.email.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.whatsapp !== undefined) data.whatsapp = dto.whatsapp.trim() || null;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl || null;
    if (dto.socials !== undefined) data.socials = dto.socials as unknown as Prisma.InputJsonValue;
    if (dto.bio !== undefined) data.bio = dto.bio.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    if (dto.invitedBy !== undefined) data.invitedBy = dto.invitedBy.trim() || null;
    if (dto.stage !== undefined) data.stage = dto.stage;

    const row = await this.prisma.prospect.update({ where: { id: guestId }, data });
    return toGuestWire(row);
  }

  /** Hard delete. Contact/visit logs cascade via the DB FK (matches the
   * local-db's manual cascade at `handlers.ts:951-952`). */
  async deleteGuest(subject: PermissionSubject, guestId: string): Promise<null> {
    const existing = await this.loadGuest(guestId);
    this.assertGuest(subject, existing, 'delete');
    await this.prisma.prospect.delete({ where: { id: guestId } });
    return null;
  }

  /** Turns a guest into a member — the guest row is kept and moved to the
   * `joined-club` stage so the pipeline history survives; a fresh
   * `Membership` starts their roster life. Wrapped in a `$transaction` so
   * a failure mid-flow doesn't leave the guest promoted but the roster
   * blank (or vice versa). */
  async convertToMember(
    subject: PermissionSubject,
    guestId: string,
    dto: ConvertGuestDto,
  ): Promise<MemberWire> {
    const existing = await this.loadGuest(guestId);
    this.assertGuest(subject, existing, 'update');

    const roles: PrismaClubRole[] =
      dto.roles && dto.roles.length > 0 ? toClubRoles(dto.roles) : ['Member' as PrismaClubRole];

    const [, membership] = await this.prisma.$transaction([
      this.prisma.prospect.update({
        where: { id: guestId },
        data: { stage: 'joined-club' },
      }),
      this.prisma.membership.create({
        data: {
          clubId: existing.clubId,
          firstName: existing.firstName,
          lastName: existing.lastName,
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

  /** ----------------------------------------------------- contact logs -- */

  async listContactLogs(subject: PermissionSubject, guestId: string): Promise<ContactLogWire[]> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'read');
    const rows = await this.prisma.contactLog.findMany({
      where: { clubId: guest.clubId, prospectId: guest.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toContactLogWire);
  }

  async createContactLog(
    subject: PermissionSubject,
    guestId: string,
    dto: CreateContactLogDto,
  ): Promise<ContactLogWire> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'create');
    const row = await this.prisma.contactLog.create({
      data: {
        clubId: guest.clubId,
        prospectId: guest.id,
        method: dto.method,
        outcome: dto.outcome.trim(),
      },
    });
    return toContactLogWire(row);
  }

  async updateContactLog(
    subject: PermissionSubject,
    guestId: string,
    logId: string,
    dto: UpdateContactLogDto,
  ): Promise<ContactLogWire> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'update');
    const existing = await this.prisma.contactLog.findUnique({ where: { id: logId } });
    if (!existing || existing.prospectId !== guest.id) {
      throw new NotFoundException(`No contact log with id "${logId}"`);
    }
    const data: Prisma.ContactLogUpdateInput = { updatedAt: new Date() };
    if (dto.method !== undefined) data.method = dto.method;
    if (dto.outcome !== undefined) data.outcome = dto.outcome.trim();
    const row = await this.prisma.contactLog.update({ where: { id: logId }, data });
    return toContactLogWire(row);
  }

  async deleteContactLog(
    subject: PermissionSubject,
    guestId: string,
    logId: string,
  ): Promise<null> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'delete');
    const existing = await this.prisma.contactLog.findUnique({ where: { id: logId } });
    if (!existing || existing.prospectId !== guest.id) {
      throw new NotFoundException(`No contact log with id "${logId}"`);
    }
    await this.prisma.contactLog.delete({ where: { id: logId } });
    return null;
  }

  /** ------------------------------------------------------ visit logs -- */

  async listVisitLogs(subject: PermissionSubject, guestId: string): Promise<VisitLogWire[]> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'read');
    // Server orders by the meeting date (matches local-db behaviour); logs
    // with a nulled `meetingId` (meeting deleted) fall to the bottom by
    // `createdAt`. A single query with `meeting: { dateTime }` sort keeps
    // it one round-trip.
    const rows = await this.prisma.visitLog.findMany({
      where: { clubId: guest.clubId, prospectId: guest.id },
      orderBy: [{ meeting: { dateTime: 'desc' } }, { createdAt: 'desc' }],
    });
    return rows.map(toVisitLogWire);
  }

  async createVisitLog(
    subject: PermissionSubject,
    guestId: string,
    dto: CreateVisitLogDto,
  ): Promise<VisitLogWire> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'create');
    await this.assertMeetingInClub(guest.clubId, dto.meetingId);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.visitLog.create({
        data: {
          clubId: guest.clubId,
          prospectId: guest.id,
          meetingId: dto.meetingId,
          role: dto.role?.trim() || null,
          notes: dto.notes?.trim() || null,
          origin: 'manual',
        },
      });
      await syncGuestVisitStats(tx, guest.id);
      return created;
    });
    return toVisitLogWire(row);
  }

  async updateVisitLog(
    subject: PermissionSubject,
    guestId: string,
    logId: string,
    dto: UpdateVisitLogDto,
  ): Promise<VisitLogWire> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'update');
    const existing = await this.prisma.visitLog.findUnique({ where: { id: logId } });
    if (!existing || existing.prospectId !== guest.id) {
      throw new NotFoundException(`No visit log with id "${logId}"`);
    }
    const data: Prisma.VisitLogUpdateInput = { updatedAt: new Date() };
    if (dto.meetingId !== undefined) {
      await this.assertMeetingInClub(guest.clubId, dto.meetingId);
      data.meeting = { connect: { id: dto.meetingId } };
    }
    if (dto.role !== undefined) data.role = dto.role.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    // Origin is a source-of-record marker, not editable — a hand-edited
    // auto log stays auto. Skip on purpose.
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.visitLog.update({ where: { id: logId }, data });
      // Only the meeting link affects the derived stats — role/notes edits
      // don't move the visit-date needle.
      if (dto.meetingId !== undefined) await syncGuestVisitStats(tx, guest.id);
      return updated;
    });
    return toVisitLogWire(row);
  }

  async deleteVisitLog(subject: PermissionSubject, guestId: string, logId: string): Promise<null> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'delete');
    const existing = await this.prisma.visitLog.findUnique({ where: { id: logId } });
    if (!existing || existing.prospectId !== guest.id) {
      throw new NotFoundException(`No visit log with id "${logId}"`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.visitLog.delete({ where: { id: logId } });
      await syncGuestVisitStats(tx, guest.id);
    });
    return null;
  }

  /** ---------------------------------------------------------- helpers -- */

  private async loadGuest(guestId: string): Promise<Prospect> {
    const row = await this.prisma.prospect.findUnique({ where: { id: guestId } });
    if (!row) throw new NotFoundException(`No guest with id "${guestId}"`);
    return row;
  }

  private assertGuest(
    subject: PermissionSubject,
    row: { clubId: string },
    action: 'read' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'guest', { clubId: row.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'guest',
        action,
        reason: 'You do not manage this club',
      });
    }
  }

  private assertLog(
    subject: PermissionSubject,
    row: { clubId: string },
    action: 'read' | 'create' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'guestLog', { clubId: row.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'guestLog',
        action,
        reason: 'You do not manage this club',
      });
    }
  }

  private async assertMeetingInClub(clubId: string, meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, clubId: true },
    });
    if (!meeting || meeting.clubId !== clubId) {
      throw new BadRequestException(`No meeting with id "${meetingId}"`);
    }
  }
}
