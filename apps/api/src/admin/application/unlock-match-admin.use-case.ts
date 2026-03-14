import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MatchRealtimePublisher } from '../../matches/realtime/match-realtime.publisher';

@Injectable()
export class UnlockMatchAdminUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimePublisher: MatchRealtimePublisher,
  ) {}

  async execute(matchId: string): Promise<{ matchId: string; isLocked: boolean }> {
    const match = await this.prisma.client.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (['canceled', 'played', 'in_progress'].includes(match.status)) {
      throw new ConflictException('MATCH_ALREADY_TERMINAL');
    }
    if (!match.isLocked) {
      return { matchId, isLocked: false };
    }

    const updated = await this.prisma.client.match.update({
      where: { id: matchId },
      data: { isLocked: false, lockedAt: null, lockedBy: null, revision: match.revision + 1 },
    });

    this.realtimePublisher.notifyMatchUpdated(matchId, updated.revision);
    return { matchId, isLocked: false };
  }
}
