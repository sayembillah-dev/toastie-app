import { Injectable } from '@nestjs/common';

export interface Greeting {
  message: string;
  service: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  getHello(): Greeting {
    return {
      message: 'Hello from the Toastly API 🍞',
      service: '@toastly/api',
      timestamp: new Date().toISOString(),
    };
  }
}
