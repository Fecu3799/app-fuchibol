import { Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

const LATE_LEAVE_PENALTY = 10;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SUSPENSION_DAYS = 14;

export function computeReliabilityLabel(score: number): string {
  if (score >= 85) return 'Cumplidor';
  if (score >= 70) return 'Confiable';
  if (score >= 50) return 'Medio loro';
  return 'Poco confiable';
}

@Injectable()
export class UserReliabilityService {
  private readonly logger = new Logger(UserReliabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applies a late-leave penalty to the user's reliability score.
   * Must be called inside an ongoing transaction (pass `tx`).
   * If the user is already suspended, this is a no-op.
   */
  async applyLateLeavePenalty(
    tx: PrismaClient | TransactionClient,
    userId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        reliabilityScore: true,
        reliabilityWindowStartedAt: true,
        suspendedUntil: true,
      },
    });

    // Already suspended: do not modify
    if (user.suspendedUntil && user.suspendedUntil > now) {
      return;
    }

    const newScore = Math.max(0, user.reliabilityScore - LATE_LEAVE_PENALTY);

    // Determine window start: reset if expired or not yet started
    let windowStart: Date;
    if (
      !user.reliabilityWindowStartedAt ||
      now.getTime() - user.reliabilityWindowStartedAt.getTime() > WINDOW_MS
    ) {
      windowStart = now;
    } else {
      windowStart = user.reliabilityWindowStartedAt;
    }

    // Trigger suspension when score hits 0 within the active window
    let suspendedUntil: Date | undefined;
    if (newScore === 0) {
      const withinWindow =
        now.getTime() - windowStart.getTime() <= WINDOW_MS;
      if (withinWindow) {
        suspendedUntil = new Date(
          now.getTime() + SUSPENSION_DAYS * 24 * 60 * 60 * 1000,
        );
        this.logger.warn(
          `[Reliability] user=${userId} score reached 0 → suspended until ${suspendedUntil.toISOString()}`,
        );
      }
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        reliabilityScore: newScore,
        reliabilityWindowStartedAt: windowStart,
        ...(suspendedUntil !== undefined && { suspendedUntil }),
      },
    });
  }
}
