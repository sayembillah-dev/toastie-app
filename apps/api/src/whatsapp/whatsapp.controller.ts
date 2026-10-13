import { Body, Controller, Get, Post } from '@nestjs/common';

import { Requires } from '@/access';

import { SendWhatsappTestDto } from './dto/whatsapp.dto';
import { WhatsappService } from './whatsapp.service';
import type { WhatsappSendResult, WhatsappStatus } from './whatsapp.types';

/** Super Admin's control panel for the club WhatsApp number. Gated on
 * `user:*` — not a WhatsApp-specific resource key — because `user` is the
 * one key only the Super Admin bypass reaches; a new key would also surface
 * in every club's permission editor. */
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Requires('user', 'read')
  @Get('status')
  status(): Promise<WhatsappStatus> {
    return this.whatsapp.getStatus();
  }

  @Requires('user', 'update')
  @Post('connect')
  connect(): Promise<WhatsappStatus> {
    return this.whatsapp.connect();
  }

  @Requires('user', 'update')
  @Post('disconnect')
  disconnect(): Promise<WhatsappStatus> {
    return this.whatsapp.disconnect();
  }

  @Requires('user', 'update')
  @Post('test-message')
  sendTest(@Body() dto: SendWhatsappTestDto): Promise<WhatsappSendResult> {
    return this.whatsapp.sendText(dto.phone, dto.text);
  }
}
