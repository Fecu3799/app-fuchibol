import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class BlockTeamAutoGenUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(matchId: string, actorId: string): Promise<void> {
    const match = await this.prisma.client.match.findUnique({
      where: { id: matchId },
    });

    if (!match) throw new NotFoundException('Match not found');
    if (match.createdById !== actorId)
      throw new ForbiddenException('ONLY_CREATOR');

    // Idempotent — no-op if already blocked or teams are already configured
    if (match.teamsAutoGenBlocked || match.teamsConfigured) return;

    await this.prisma.client.match.update({
      where: { id: matchId },
      data: { teamsAutoGenBlocked: true },
    });
  }
}
