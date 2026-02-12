import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateMatchUseCase } from '../application/create-match.use-case';
import { GetMatchUseCase } from '../application/get-match.use-case';
import { CreateMatchDto } from './dto/create-match.dto';
import { CreateMatchResponseDto } from './dto/create-match-response.dto';
import { GetMatchResponseDto } from './dto/match-snapshot.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Actor } from '../../auth/decorators/actor.decorator';
import type { ActorPayload } from '../../auth/interfaces/actor-payload.interface';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly createMatchUseCase: CreateMatchUseCase,
    private readonly getMatchUseCase: GetMatchUseCase,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() body: CreateMatchDto,
    @Actor() actor: ActorPayload,
  ): Promise<CreateMatchResponseDto> {
    return this.createMatchUseCase.execute({
      ...body,
      createdById: actor.userId,
    });
  }

  @Get(':id')
  async get(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<GetMatchResponseDto> {
    const match = await this.getMatchUseCase.execute(id);
    return { match };
  }
}
