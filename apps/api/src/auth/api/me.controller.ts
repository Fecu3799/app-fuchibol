import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Actor } from '../decorators/actor.decorator';
import type { ActorPayload } from '../interfaces/actor-payload.interface';
import { GetMeUseCase } from '../application/get-me.use-case';

@Controller()
export class MeController {
  constructor(private readonly getMeUseCase: GetMeUseCase) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Actor() actor: ActorPayload) {
    return this.getMeUseCase.execute(actor.userId);
  }
}
