import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetDashboardQuery } from '../application/get-dashboard.query';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDashboardController {
  constructor(private readonly getDashboard: GetDashboardQuery) {}

  @Get()
  async get() {
    return this.getDashboard.execute();
  }
}
