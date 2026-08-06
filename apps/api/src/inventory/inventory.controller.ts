import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { actorMembershipIdFor, CurrentContext, type RequestContext, Requires } from '@/access';

import {
  CreateChecklistItemDto,
  CreateInventoryItemDto,
  UpdateChecklistItemDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';
import { type ChecklistItemWire, type InventoryItemWire } from './serializers';

@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** ------------------------------------------------ inventory items -- */

  @Requires('inventory', 'read')
  @Get('inventory-items')
  listItems(@CurrentContext() ctx: RequestContext): Promise<InventoryItemWire[]> {
    const clubId = requireClubContext(ctx);
    return this.inventory.listItems(ctx.subject, clubId);
  }

  @Requires('inventory', 'read')
  @Get('inventory-items/:itemId')
  getItem(
    @CurrentContext() ctx: RequestContext,
    @Param('itemId') itemId: string,
  ): Promise<InventoryItemWire> {
    return this.inventory.getItem(ctx.subject, itemId);
  }

  @Requires('inventory', 'create')
  @Post('inventory-items')
  createItem(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateInventoryItemDto,
  ): Promise<InventoryItemWire> {
    const clubId = requireClubContext(ctx);
    return this.inventory.createItem(ctx.subject, clubId, actorMembershipIdFor(ctx, clubId), dto);
  }

  @Requires('inventory', 'update')
  @Patch('inventory-items/:itemId')
  updateItem(
    @CurrentContext() ctx: RequestContext,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemWire> {
    const clubId = ctx.clubId;
    return this.inventory.updateItem(
      ctx.subject,
      itemId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('inventory', 'delete')
  @Delete('inventory-items/:itemId')
  deleteItem(
    @CurrentContext() ctx: RequestContext,
    @Param('itemId') itemId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.inventory.deleteItem(
      ctx.subject,
      itemId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }

  /** ---------------------------------------------------- checklist -- */

  @Requires('checklist', 'read')
  @Get('meetings/:meetingId/checklist')
  listChecklist(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<ChecklistItemWire[]> {
    return this.inventory.listChecklist(ctx.subject, meetingId);
  }

  @Requires('checklist', 'create')
  @Post('meetings/:meetingId/checklist')
  createChecklistItem(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateChecklistItemDto,
  ): Promise<ChecklistItemWire> {
    const clubId = ctx.clubId;
    return this.inventory.createChecklistItem(
      ctx.subject,
      meetingId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('checklist', 'update')
  @Patch('meetings/:meetingId/checklist/:itemId')
  updateChecklistItem(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ): Promise<ChecklistItemWire> {
    const clubId = ctx.clubId;
    return this.inventory.updateChecklistItem(
      ctx.subject,
      meetingId,
      itemId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('checklist', 'delete')
  @Delete('meetings/:meetingId/checklist/:itemId')
  deleteChecklistItem(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('itemId') itemId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.inventory.deleteChecklistItem(
      ctx.subject,
      meetingId,
      itemId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }
}

function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Inventory items are only accessible from a club context',
    });
  }
  return ctx.clubId;
}
