import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LookupUserQuery } from '../application/lookup-user.query';

@Controller('users')
export class UsersController {
  constructor(private readonly lookupUserQuery: LookupUserQuery) {}

  @UseGuards(JwtAuthGuard)
  @Get('lookup')
  async lookup(@Query('query') query: string) {
    return this.lookupUserQuery.execute(query);
  }
}
