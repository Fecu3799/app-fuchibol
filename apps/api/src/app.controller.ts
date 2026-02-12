import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'app-fuchibol-api',
      time: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.1',
    };
  }
}
