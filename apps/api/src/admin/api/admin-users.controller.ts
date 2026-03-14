import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Actor } from '../../auth/decorators/actor.decorator';
import type { ActorPayload } from '../../auth/interfaces/actor-payload.interface';
import { ListAdminUsersQuery } from '../application/list-admin-users.query';
import { GetAdminUserQuery } from '../application/get-admin-user.query';
import { BanUserUseCase } from '../application/ban-user.use-case';
import { UnbanUserUseCase } from '../application/unban-user.use-case';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminBanDto } from './dto/admin-ban.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(
    private readonly listUsers: ListAdminUsersQuery,
    private readonly getUser: GetAdminUserQuery,
    private readonly banUser: BanUserUseCase,
    private readonly unbanUser: UnbanUserUseCase,
  ) {}

  @Get()
  async list(@Query() query: AdminUsersQueryDto) {
    return this.listUsers.execute(query);
  }

  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.getUser.execute(id);
  }

  @Post(':id/ban')
  async ban(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminBanDto,
    @Actor() actor: ActorPayload,
  ) {
    this.logger.warn({
      op: 'adminBanUser',
      actorUserId: actor.userId,
      targetUserId: id,
      reason: dto.reason,
    });
    return this.banUser.execute({ userId: id, reason: dto.reason });
  }

  @Post(':id/unban')
  async unban(
    @Param('id', ParseUUIDPipe) id: string,
    @Actor() actor: ActorPayload,
  ) {
    this.logger.log({
      op: 'adminUnbanUser',
      actorUserId: actor.userId,
      targetUserId: id,
    });
    return this.unbanUser.execute(id);
  }
}
