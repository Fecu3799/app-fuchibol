import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class DeleteMatchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(matchId: string): Promise<void> {
    const match = await this.prisma.client.match.findUnique({
      where: { id: matchId },
      select: { id: true },
    });
    if (!match) throw new NotFoundException('Match not found');

    // NotificationDelivery has no FK/cascade to match, must be deleted manually.
    // All other related models (participants, auditLogs, teamSlots, conversation+messages)
    // have onDelete: Cascade and will be cleaned up automatically.
    await this.prisma.client.$transaction([
      this.prisma.client.notificationDelivery.deleteMany({ where: { matchId } }),
      this.prisma.client.match.delete({ where: { id: matchId } }),
    ]);
  }
}
