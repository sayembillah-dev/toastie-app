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

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { ConvertGuestDto, CreateGuestDto, UpdateGuestDto } from './dto/guests.dto';
import {
  CreateContactLogDto,
  CreateVisitLogDto,
  UpdateContactLogDto,
  UpdateVisitLogDto,
} from './dto/logs.dto';
import { PeopleService } from './people.service';
import {
  type ContactLogWire,
  type ConvertGuestResultWire,
  type GuestMatchWire,
  type GuestWire,
  type VisitLogWire,
} from './serializers';

@Controller('guests')
export class GuestsController {
  constructor(private readonly people: PeopleService) {}

  @Requires('guest', 'read')
  @Get()
  list(@CurrentContext() ctx: RequestContext): Promise<GuestWire[]> {
    const clubId = requireClubContext(ctx);
    return this.people.listGuests(ctx.subject, clubId);
  }

  @Requires('guest', 'create')
  @Post()
  create(@CurrentContext() ctx: RequestContext, @Body() dto: CreateGuestDto): Promise<GuestWire> {
    const clubId = requireClubContext(ctx);
    return this.people.createGuest(ctx.subject, clubId, dto);
  }

  @Requires('guest', 'read')
  @Get(':guestId')
  get(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
  ): Promise<GuestWire> {
    return this.people.getGuest(ctx.subject, guestId);
  }

  @Requires('guest', 'update')
  @Patch(':guestId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
    @Body() dto: UpdateGuestDto,
  ): Promise<GuestWire> {
    return this.people.updateGuest(ctx.subject, guestId, dto);
  }

  @Requires('guest', 'delete')
  @Delete(':guestId')
  delete(@CurrentContext() ctx: RequestContext, @Param('guestId') guestId: string): Promise<null> {
    return this.people.deleteGuest(ctx.subject, guestId);
  }

  @Requires('guest', 'read')
  @Get(':guestId/match')
  checkGuestMatch(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
  ): Promise<GuestMatchWire> {
    return this.people.checkGuestMatch(ctx.subject, guestId);
  }

  @Requires('guest', 'update')
  @Post(':guestId/convert-to-member')
  convertToMember(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
    @Body() dto: ConvertGuestDto,
  ): Promise<ConvertGuestResultWire> {
    return this.people.convertToMember(ctx.subject, ctx.session.user.id, guestId, dto);
  }

  @Requires('guestLog', 'read')
  @Get(':guestId/contact-logs')
  listContactLogs(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
  ): Promise<ContactLogWire[]> {
    return this.people.listContactLogs(ctx.subject, guestId);
  }

  @Requires('guestLog', 'create')
  @Post(':guestId/contact-logs')
  createContactLog(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
    @Body() dto: CreateContactLogDto,
  ): Promise<ContactLogWire> {
    return this.people.createContactLog(ctx.subject, guestId, dto);
  }

  @Requires('guestLog', 'update')
  @Patch(':guestId/contact-logs/:logId')
  updateContactLog(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
    @Param('logId') logId: string,
    @Body() dto: UpdateContactLogDto,
  ): Promise<ContactLogWire> {
    return this.people.updateContactLog(ctx.subject, guestId, logId, dto);
  }

  @Requires('guestLog', 'delete')
  @Delete(':guestId/contact-logs/:logId')
  deleteContactLog(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
    @Param('logId') logId: string,
  ): Promise<null> {
    return this.people.deleteContactLog(ctx.subject, guestId, logId);
  }

  @Requires('guestLog', 'read')
  @Get(':guestId/visit-logs')
  listVisitLogs(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
  ): Promise<VisitLogWire[]> {
    return this.people.listVisitLogs(ctx.subject, guestId);
  }

  @Requires('guestLog', 'create')
  @Post(':guestId/visit-logs')
  createVisitLog(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
    @Body() dto: CreateVisitLogDto,
  ): Promise<VisitLogWire> {
    return this.people.createVisitLog(ctx.subject, guestId, dto);
  }

  @Requires('guestLog', 'update')
  @Patch(':guestId/visit-logs/:logId')
  updateVisitLog(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
    @Param('logId') logId: string,
    @Body() dto: UpdateVisitLogDto,
  ): Promise<VisitLogWire> {
    return this.people.updateVisitLog(ctx.subject, guestId, logId, dto);
  }

  @Requires('guestLog', 'delete')
  @Delete(':guestId/visit-logs/:logId')
  deleteVisitLog(
    @CurrentContext() ctx: RequestContext,
    @Param('guestId') guestId: string,
    @Param('logId') logId: string,
  ): Promise<null> {
    return this.people.deleteVisitLog(ctx.subject, guestId, logId);
  }
}

function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Guests are only accessible from a club context',
    });
  }
  return ctx.clubId;
}
