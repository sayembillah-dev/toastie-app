import { Controller, Get } from '@nestjs/common';

import { Public } from '@/access';

import { AppService, type Greeting } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): Greeting {
    return this.appService.getHello();
  }
}
