import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

const ACTIVE_STATUSES = ['CONFIRMED', 'WAITLISTED', 'SPECTATOR'] as const;
const READONLY_STATUSES = ['played', 'canceled'] as const;

export interface MatchAccessResult {
  allowed: boolean;
  isReadOnly: boolean;
}

@Injectable()
export class MatchChatAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async checkAccess(
    matchId: string,
    userId: string,
    client?: PrismaClient | TransactionClient,
  ): Promise<MatchAccessResult> {
    const db = client ?? this.prisma.client;

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { createdById: true, status: true },
    });

    if (!match) return { allowed: false, isReadOnly: false };

    const isReadOnly = (READONLY_STATUSES as readonly string[]).includes(
      match.status,
    );

    if (match.createdById === userId) {
      return { allowed: true, isReadOnly };
    }

    const participant = await db.matchParticipant.findUnique({
      where: { matchId_userId: { matchId, userId } },
      select: { status: true },
    });

    const allowed =
      participant !== null &&
      (ACTIVE_STATUSES as readonly string[]).includes(participant.status);

    return { allowed, isReadOnly };
  }
}
