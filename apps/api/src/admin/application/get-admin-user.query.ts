import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class GetAdminUserQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        emailVerifiedAt: true,
        bannedAt: true,
        banReason: true,
        suspendedUntil: true,
        lateLeaveCount: true,
        reliabilityScore: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const [pushTokens, matchesCreated, matchesJoined] = await Promise.all([
      this.prisma.client.pushDevice.findMany({
        where: { userId, disabledAt: null },
        select: { expoPushToken: true, createdAt: true },
      }),
      this.prisma.client.match.count({ where: { createdById: userId } }),
      this.prisma.client.matchParticipant.count({
        where: { userId, status: { in: ['CONFIRMED', 'INVITED', 'WAITLISTED'] } },
      }),
    ]);

    return {
      ...user,
      pushTokens,
      stats: { matchesCreated, matchesJoined },
    };
  }
}
