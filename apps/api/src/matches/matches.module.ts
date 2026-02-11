import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { MatchesController } from './api/matches.controller';
import { CreateMatchUseCase } from './application/create-match.use-case';
import { GetMatchUseCase } from './application/get-match.use-case';

@Module({
  imports: [PrismaModule],
  controllers: [MatchesController],
  providers: [CreateMatchUseCase, GetMatchUseCase],
})
export class MatchesModule {}
