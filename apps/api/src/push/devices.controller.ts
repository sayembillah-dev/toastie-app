import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';

import { type AuthenticatedUser, CurrentUser } from '@/auth';

import { RegisterDeviceDto } from './dto/devices.dto';
import { NativePushService } from './native-push.service';

/** Native app installs. Account-scoped like `/push/*` — no club context. */
@Controller('devices')
export class DevicesController {
  constructor(private readonly push: NativePushService) {}

  @Post()
  @HttpCode(204)
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDeviceDto): Promise<void> {
    return this.push.register(user.id, dto.platform, dto.token);
  }

  @Delete(':token')
  @HttpCode(204)
  unregister(@CurrentUser() user: AuthenticatedUser, @Param('token') token: string): Promise<void> {
    return this.push.unregister(user.id, token);
  }
}
