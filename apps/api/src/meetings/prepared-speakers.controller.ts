import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { actorMembershipIdFor, CurrentContext, type RequestContext, Requires } from '@/access';

import { CreatePreparedSpeakerDto, UpdatePreparedSpeakerDto } from './dto/prepared-speakers.dto';
import { PreparedSpeakersService } from './prepared-speakers.service';
import { type PreparedSpeakerWire } from './serializers';

@Controller('meetings/:meetingId/prepared-speakers')
export class PreparedSpeakersController {
  constructor(private readonly speakers: PreparedSpeakersService) {}

  @Requires('meetingRole', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<PreparedSpeakerWire[]> {
    return this.speakers.list(ctx.subject, meetingId);
  }

  @Requires('meetingRole', 'create')
  @Post()
  create(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Body() dto: CreatePreparedSpeakerDto,
  ): Promise<PreparedSpeakerWire> {
    const clubId = ctx.clubId;
    return this.speakers.create(
      ctx.subject,
      meetingId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('meetingRole', 'update')
  @Patch(':speakerId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('speakerId') speakerId: string,
    @Body() dto: UpdatePreparedSpeakerDto,
  ): Promise<PreparedSpeakerWire> {
    const clubId = ctx.clubId;
    return this.speakers.update(
      ctx.subject,
      meetingId,
      speakerId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('meetingRole', 'delete')
  @Delete(':speakerId')
  delete(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('speakerId') speakerId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.speakers.delete(
      ctx.subject,
      meetingId,
      speakerId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }
}
