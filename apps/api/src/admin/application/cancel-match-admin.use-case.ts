import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MatchRealtimePublisher } from '../../matches/realtime/match-realtime.publisher';
import { MatchNotificationService } from '../../matches/application/notifications/match-notification.service';

@Injectable()
export class CancelMatchAdminUseCase {
  private readonly logger = new Logger(CancelMatchAdminUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimePublisher: MatchRealtimePublisher,
    private readonly matchNotification: MatchNotificationService,
  ) {}

  async execute(matchId: string): Promise<{ matchId: string; status: string }> {
    let newRevision: number | null = null;
    let participantUserIds: string[] = [];
    let matchTitle = '';

    await this.prisma.client.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id: matchId } });
      if (!match) throw new NotFoundException('Match not found');

      if (['canceled', 'played', 'in_progress'].includes(match.status)) {
        throw new ConflictException('MATCH_ALREADY_TERMINAL');
      }

      const updated = await tx.match.update({
        where: { id: matchId },
        data: { status: 'canceled', revision: match.revision + 1 },
      });

      const rows = await tx.matchParticipant.findMany({
        where: {
          matchId,
          status: { in: ['CONFIRMED', 'WAITLISTED', 'INVITED', 'SPECTATOR'] },
        },
        select: { userId: true },
      });

      newRevision = updated.revision;
      matchTitle = match.title;
      participantUserIds = rows.map((r) => r.userId);
    });

    if (newRevision !== null) {
      this.realtimePublisher.notifyMatchUpdated(matchId, newRevision);

      void this.matchNotification
        .onCanceled({
          matchId,
          matchTitle,
          userIds: participantUserIds,
          actorId: null,
        })
        .catch((err: unknown) =>
          this.logger.warn(
            `[AdminCancel] onCanceled failed for match ${matchId}: ${(err as Error)?.message}`,
          ),
        );
    }

    return { matchId, status: 'canceled' };
  }
}
