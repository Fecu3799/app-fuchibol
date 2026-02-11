import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateMatchUseCase } from '../application/create-match.use-case';
import { GetMatchUseCase } from '../application/get-match.use-case';
import { CreateMatchDto } from './dto/create-match.dto';
import { CreateMatchResponseDto } from './dto/create-match-response.dto';
import { GetMatchResponseDto } from './dto/match-snapshot.dto';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly createMatchUseCase: CreateMatchUseCase,
    private readonly getMatchUseCase: GetMatchUseCase,
  ) {}

  @Post()
  async create(
    @Body() body: CreateMatchDto,
    @Req() req: Request,
  ): Promise<CreateMatchResponseDto> {
    const userId = req.user?.id ?? 'dev-user-1';
    return this.createMatchUseCase.execute({
      ...body,
      createdById: userId,
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
