import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class GetAdminMatchQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(matchId: string) {
    const match = await this.prisma.client.match.findUnique({
      where: { id: matchId },
      include: {
        createdBy: { select: { id: true, username: true, email: true } },
        participants: {
          include: { user: { select: { id: true, username: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!match) throw new NotFoundException('Match not found');

    const [notifications, auditLogs] = await Promise.all([
      this.prisma.client.notificationDelivery.findMany({
        where: { matchId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, userId: true, type: true, bucket: true, createdAt: true },
      }),
      this.prisma.client.matchAuditLog.findMany({
        where: { matchId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, type: true, actorId: true, metadata: true, createdAt: true },
      }),
    ]);

    const grouped = {
      confirmed: match.participants.filter(p => p.status === 'CONFIRMED'),
      invited: match.participants.filter(p => p.status === 'INVITED'),
      waitlisted: match.participants.filter(p => p.status === 'WAITLISTED'),
      spectators: match.participants.filter(p => p.status === 'SPECTATOR'),
    };

    return {
      id: match.id,
      title: match.title,
      status: match.status,
      isLocked: match.isLocked,
      startsAt: match.startsAt,
      capacity: match.capacity,
      revision: match.revision,
      createdAt: match.createdAt,
      creator: match.createdBy,
      participants: grouped,
      notifications,
      auditLogs,
    };
  }
}
