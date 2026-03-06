import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Actor } from '../decorators/actor.decorator';
import type { ActorPayload } from '../interfaces/actor-payload.interface';
import { GetMeUseCase } from '../application/get-me.use-case';
import { UpdateMeUseCase } from '../application/update-me.use-case';
import { UpdateMeDto } from './dto/update-me.dto';

@Controller()
export class MeController {
  constructor(
    private readonly getMeUseCase: GetMeUseCase,
    private readonly updateMeUseCase: UpdateMeUseCase,
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
}
