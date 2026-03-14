import {
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { ListAdminMatchesQuery } from '../application/list-admin-matches.query';
import { GetAdminMatchQuery } from '../application/get-admin-match.query';
import { CancelMatchAdminUseCase } from '../application/cancel-match-admin.use-case';
import { DeleteMatchUseCase } from '../application/delete-match.use-case';
import { UnlockMatchAdminUseCase } from '../application/unlock-match-admin.use-case';
import { AdminMatchesQueryDto } from './dto/admin-matches-query.dto';

@Controller('admin/matches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminMatchesController {
  private readonly logger = new Logger(AdminMatchesController.name);

  constructor(
    private readonly listMatches: ListAdminMatchesQuery,
    private readonly getMatch: GetAdminMatchQuery,
    private readonly cancelMatch: CancelMatchAdminUseCase,
    private readonly deleteMatch: DeleteMatchUseCase,
    private readonly unlockMatch: UnlockMatchAdminUseCase,
  ) {}

  @Get()
  async list(@Query() query: AdminMatchesQueryDto) {
    return this.listMatches.execute(query);
  }

  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.getMatch.execute(id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Actor() actor: ActorPayload,
  ) {
    this.logger.warn({
      op: 'adminCancelMatch',
      actorUserId: actor.userId,
      matchId: id,
    });
    return this.cancelMatch.execute(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Actor() actor: ActorPayload,
  ) {
    this.logger.warn({
      op: 'adminDeleteMatch',
      actorUserId: actor.userId,
      matchId: id,
    });
    await this.deleteMatch.execute(id);
  }

  @Post(':id/unlock')
  @HttpCode(200)
  async unlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Actor() actor: ActorPayload,
  ) {
    this.logger.log({
      op: 'adminUnlockMatch',
      actorUserId: actor.userId,
      matchId: id,
    });
    return this.unlockMatch.execute(id);
  }
}
