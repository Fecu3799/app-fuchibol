import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { MatchSnapshotService } from '../shared/match-snapshot.service';
import type { MatchSnapshot } from '../shared/match-snapshot.service';

export { type MatchSnapshot };

@Injectable()
export class GetMatchUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: MatchSnapshotService,
  ) {}

  async execute(matchId: string, actorId?: string): Promise<MatchSnapshot> {
    const match = await this.prisma.client.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return this.snapshot.build(matchId, actorId ?? '');
  }
}
