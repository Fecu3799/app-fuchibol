import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Actor } from '../decorators/actor.decorator';
import type { ActorPayload } from '../interfaces/actor-payload.interface';
import { GetMeUseCase } from '../application/get-me.use-case';
import { UpdateMeUseCase } from '../application/update-me.use-case';
import { UpdateMeDto } from './dto/update-me.dto';
import { PrepareAvatarUseCase } from '../application/prepare-avatar.use-case';
import { ConfirmAvatarUseCase } from '../application/confirm-avatar.use-case';
import { PrepareAvatarDto } from './dto/prepare-avatar.dto';
import { ConfirmAvatarDto } from './dto/confirm-avatar.dto';

@Controller()
export class MeController {
  constructor(
    private readonly getMeUseCase: GetMeUseCase,
    private readonly updateMeUseCase: UpdateMeUseCase,
    private readonly prepareAvatarUseCase: PrepareAvatarUseCase,
    private readonly confirmAvatarUseCase: ConfirmAvatarUseCase,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Actor() actor: ActorPayload) {
    return this.getMeUseCase.execute(actor.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Actor() actor: ActorPayload, @Body() dto: UpdateMeDto) {
    return this.updateMeUseCase.execute({ userId: actor.userId, ...dto });
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar/prepare')
  async prepareAvatar(
    @Actor() actor: ActorPayload,
    @Body() dto: PrepareAvatarDto,
  ) {
    return this.prepareAvatarUseCase.execute(actor.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar/confirm')
  async confirmAvatar(
    @Actor() actor: ActorPayload,
    @Body() dto: ConfirmAvatarDto,
  ) {
    return this.confirmAvatarUseCase.execute(actor.userId, dto);
  }
}
