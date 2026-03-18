import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LookupUserQuery } from '../application/lookup-user.query';
import { GetPublicProfileQuery } from '../application/get-public-profile.query';
import { GetUserSettingsQuery } from '../application/get-user-settings.query';
import { UpdateUserSettingsUseCase } from '../application/update-user-settings.use-case';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly lookupUserQuery: LookupUserQuery,
    private readonly getPublicProfileQuery: GetPublicProfileQuery,
    private readonly getUserSettingsQuery: GetUserSettingsQuery,
    private readonly updateUserSettingsUseCase: UpdateUserSettingsUseCase,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me/settings')
  async getSettings(@Req() req: { user: { userId: string } }) {
    return this.getUserSettingsQuery.execute(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/settings')
  async updateSettings(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateUserSettingsDto,
  ) {
    return this.updateUserSettingsUseCase.execute({
      userId: req.user.userId,
      ...dto,
    });
  }

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
