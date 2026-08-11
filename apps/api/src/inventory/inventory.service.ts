import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { ActivityService } from '@/activity';
import { PrismaService } from '@/prisma';
import { StorageService } from '@/storage';

import type {
  CreateChecklistItemDto,
  CreateInventoryItemDto,
  UpdateChecklistItemDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';
import {
  type ChecklistItemWire,
  type InventoryItemWire,
  toChecklistItemWire,
  toInventoryItemWire,
  toInventoryItemWires,
} from './serializers';

/** The default checklist items an SAA never lands on a blank list — mirrors
 * `DEFAULT_CHECKLIST_TEXTS` in the web module. Seeded on first read of a
 * meeting's checklist, matching the local-db behaviour. */
const DEFAULT_CHECKLIST_TEXTS = [
  'Arrange chairs and tables',
  'Display the club banner',
  'Print Agenda and others documents',
  'Gather Time Ballots',
  'Food for the guests',
] as const;

/** Handles `/inventory-items` (physical assets) and
 * `/meetings/:meetingId/checklist` (per-meeting SAA prep). Both belong to
 * the `inventory` / `checklist` resources per the plan's split. */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
  ) {}

  /** -------------------------------------------------- inventory items -- */

  async listItems(subject: PermissionSubject, clubId: string): Promise<InventoryItemWire[]> {
    this.assertInventory(subject, clubId, 'read');
    const rows = await this.prisma.inventoryItem.findMany({
      where: { clubId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return toInventoryItemWires(rows, this.storage);
  }

  async getItem(subject: PermissionSubject, itemId: string): Promise<InventoryItemWire> {
    const row = await this.prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!row) throw new NotFoundException(`No inventory item with id "${itemId}"`);
    this.assertInventory(subject, row.clubId, 'read');
    return toInventoryItemWire(row, this.storage);
  }

  async createItem(
    subject: PermissionSubject,
    clubId: string,
    actorMembershipId: string | null,
    dto: CreateInventoryItemDto,
  ): Promise<InventoryItemWire> {
    this.assertInventory(subject, clubId, 'create');
    if (dto.imageUrl) this.storage.assertOwnedKey(dto.imageUrl, 'inventory', clubId);
    const row = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          clubId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          imageUrl: dto.imageUrl ?? null,
          imageMimeType: dto.imageMimeType ?? null,
        },
      });
      await this.activity.record(
        {
          clubId,
          actorMembershipId,
          category: 'inventory',
          action: 'added an inventory item',
          summary: `Added "${item.title}" to the inventory`,
          entityType: 'inventoryItem',
          entityId: item.id,
        },
        tx,
      );
      return item;
    });
    return toInventoryItemWire(row, this.storage);
  }

  async updateItem(
    subject: PermissionSubject,
    itemId: string,
    actorMembershipId: string | null,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemWire> {
    const existing = await this.prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!existing) throw new NotFoundException(`No inventory item with id "${itemId}"`);
    this.assertInventory(subject, existing.clubId, 'update');

    const data: Prisma.InventoryItemUpdateInput = { updatedAt: new Date() };
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) {
      data.description = dto.description === null ? null : dto.description.trim() || null;
    }
    // `imageUrl: null` explicitly clears the image (and its mime type); an
    // undefined `imageUrl` leaves both alone. Setting one without the other
    // is a validation error handled by the DTO.
    if (dto.imageUrl !== undefined) {
      if (dto.imageUrl) this.storage.assertOwnedKey(dto.imageUrl, 'inventory', existing.clubId);
      data.imageUrl = dto.imageUrl ?? null;
      data.imageMimeType = dto.imageUrl === null ? null : (dto.imageMimeType ?? null);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({ where: { id: itemId }, data });
      await this.activity.record(
        {
          clubId: item.clubId,
          actorMembershipId,
          category: 'inventory',
          action: 'updated an inventory item',
          summary: `Updated inventory item "${item.title}"`,
          entityType: 'inventoryItem',
          entityId: item.id,
        },
        tx,
      );
      return item;
    });
    if (dto.imageUrl !== undefined && existing.imageUrl && existing.imageUrl !== row.imageUrl) {
      await this.storage.remove(existing.imageUrl);
    }
    return toInventoryItemWire(row, this.storage);
  }

  async deleteItem(
    subject: PermissionSubject,
    itemId: string,
    actorMembershipId: string | null,
  ): Promise<null> {
    const existing = await this.prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!existing) throw new NotFoundException(`No inventory item with id "${itemId}"`);
    this.assertInventory(subject, existing.clubId, 'delete');

    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryItem.delete({ where: { id: itemId } });
      await this.activity.record(
        {
          clubId: existing.clubId,
          actorMembershipId,
          category: 'inventory',
          action: 'deleted an inventory item',
          summary: `Deleted inventory item "${existing.title}"`,
          entityType: 'inventoryItem',
          entityId: existing.id,
        },
        tx,
      );
    });
    await this.storage.remove(existing.imageUrl);
    return null;
  }

  /** ------------------------------------------------------- checklist -- */

  /** Seeds the meeting's checklist with the default rows on first read, so
   * an SAA never lands on a blank list. Matches the local-db behaviour. */
  async listChecklist(subject: PermissionSubject, meetingId: string): Promise<ChecklistItemWire[]> {
    const meeting = await this.requireMeeting(meetingId);
    this.assertChecklist(subject, meeting.clubId, 'read');

    const existing = await this.prisma.checklistItem.findMany({
      where: { clubId: meeting.clubId, meetingId: meeting.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (existing.length > 0) return existing.map(toChecklistItemWire);

    // First read — materialise the defaults. `createManyAndReturn` would be
    // ideal (Prisma 5.14+) but skipDuplicates + a second read keeps it
    // portable to earlier client versions.
    await this.prisma.checklistItem.createMany({
      data: DEFAULT_CHECKLIST_TEXTS.map((text) => ({
        clubId: meeting.clubId,
        meetingId: meeting.id,
        text,
        done: false,
      })),
    });
    const seeded = await this.prisma.checklistItem.findMany({
      where: { clubId: meeting.clubId, meetingId: meeting.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return seeded.map(toChecklistItemWire);
  }

  async createChecklistItem(
    subject: PermissionSubject,
    meetingId: string,
    actorMembershipId: string | null,
    dto: CreateChecklistItemDto,
  ): Promise<ChecklistItemWire> {
    const meeting = await this.requireMeeting(meetingId);
    this.assertChecklist(subject, meeting.clubId, 'create');

    const row = await this.prisma.$transaction(async (tx) => {
      const item = await tx.checklistItem.create({
        data: {
          clubId: meeting.clubId,
          meetingId: meeting.id,
          text: dto.text.trim(),
          done: false,
        },
      });
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'inventory',
          action: 'added a checklist item',
          summary: `Added "${item.text}" to the Meeting ${meeting.meetingNumber} checklist`,
          entityType: 'checklistItem',
          entityId: item.id,
        },
        tx,
      );
      return item;
    });
    return toChecklistItemWire(row);
  }

  async updateChecklistItem(
    subject: PermissionSubject,
    meetingId: string,
    itemId: string,
    actorMembershipId: string | null,
    dto: UpdateChecklistItemDto,
  ): Promise<ChecklistItemWire> {
    const meeting = await this.requireMeeting(meetingId);
    this.assertChecklist(subject, meeting.clubId, 'update');
    const existing = await this.prisma.checklistItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.meetingId !== meeting.id) {
      throw new NotFoundException(`No checklist item with id "${itemId}"`);
    }

    const data: Prisma.ChecklistItemUpdateInput = { updatedAt: new Date() };
    if (dto.text !== undefined) data.text = dto.text.trim();
    if (dto.done !== undefined) data.done = dto.done;

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.checklistItem.update({ where: { id: itemId }, data });
      // Only log a done-toggle — a text rename isn't club-audit-worthy and
      // would clutter the feed. Matches the local-db's activity emission.
      if (dto.done !== undefined && dto.done !== existing.done) {
        await this.activity.record(
          {
            clubId: meeting.clubId,
            actorMembershipId,
            category: 'inventory',
            action: dto.done ? 'checked off a checklist item' : 'unchecked a checklist item',
            summary: `${dto.done ? 'Checked off' : 'Unchecked'} "${updated.text}" for Meeting ${meeting.meetingNumber}`,
            entityType: 'checklistItem',
            entityId: updated.id,
          },
          tx,
        );
      }
      return updated;
    });
    return toChecklistItemWire(row);
  }

  async deleteChecklistItem(
    subject: PermissionSubject,
    meetingId: string,
    itemId: string,
    actorMembershipId: string | null,
  ): Promise<null> {
    const meeting = await this.requireMeeting(meetingId);
    this.assertChecklist(subject, meeting.clubId, 'delete');
    const existing = await this.prisma.checklistItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.meetingId !== meeting.id) {
      throw new NotFoundException(`No checklist item with id "${itemId}"`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.checklistItem.delete({ where: { id: itemId } });
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'inventory',
          action: 'deleted a checklist item',
          summary: `Deleted "${existing.text}" from the Meeting ${meeting.meetingNumber} checklist`,
          entityType: 'checklistItem',
          entityId: existing.id,
        },
        tx,
      );
    });
    return null;
  }

  /** ---------------------------------------------------------- helpers -- */

  private async requireMeeting(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, clubId: true, meetingNumber: true },
    });
    if (!meeting) throw new NotFoundException(`No meeting with id "${meetingId}"`);
    return meeting;
  }

  private assertInventory(
    subject: PermissionSubject,
    clubId: string,
    action: 'read' | 'create' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'inventory', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'inventory',
        action,
        reason: 'You do not manage this club',
      });
    }
  }

  private assertChecklist(
    subject: PermissionSubject,
    clubId: string,
    action: 'read' | 'create' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'checklist', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'checklist',
        action,
        reason: 'You do not manage this club',
      });
    }
  }
}
