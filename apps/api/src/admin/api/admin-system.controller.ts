import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetSystemHealthQuery } from '../application/get-system-health.query';

@Controller('admin/system')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminSystemController {
  constructor(private readonly getHealth: GetSystemHealthQuery) {}

  @Get('health')
  async health() {
    return this.getHealth.execute();
  }
}
