import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';

export { type MatchSnapshot };

@Injectable()
export class GetMatchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(matchId: string, actorId?: string): Promise<MatchSnapshot> {
    const match = await this.prisma.client.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return buildMatchSnapshot(this.prisma.client, matchId, actorId ?? '');
  }
}
