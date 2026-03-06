import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LookupUserQuery } from '../application/lookup-user.query';
import { GetPublicProfileQuery } from '../application/get-public-profile.query';

@Controller('users')
export class UsersController {
  constructor(
    private readonly lookupUserQuery: LookupUserQuery,
    private readonly getPublicProfileQuery: GetPublicProfileQuery,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('lookup')
  async lookup(@Query('query') query: string) {
    return this.lookupUserQuery.execute(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/public-profile')
  async publicProfile(@Param('id') id: string) {
    return this.getPublicProfileQuery.execute(id);
  }
}
