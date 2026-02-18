import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';

export interface UpdateMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  title?: string;
  startsAt?: string;
  location?: string;
  capacity?: number;
}

/** Fields whose change triggers reconfirmation (CONFIRMED -> INVITED). */
const MAJOR_CHANGE_FIELDS: (keyof UpdateMatchInput)[] = [
  'startsAt',
  'location',
];

@Injectable()
export class UpdateMatchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateMatchInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.createdById !== input.actorId) {
        throw new ForbiddenException('Only match admin can update');
      }

      if (match.status === 'canceled') {
        throw new ConflictException('MATCH_CANCELLED');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      if (match.isLocked) {
        throw new ConflictException('MATCH_LOCKED');
      }

      // Build data to update (only fields that actually changed)
      const data: Record<string, unknown> = {};
      if (input.title !== undefined && input.title !== match.title)
        data.title = input.title;
      if (input.startsAt !== undefined) {
        const newStartsAt = new Date(input.startsAt);
        if (newStartsAt.getTime() !== match.startsAt.getTime())
          data.startsAt = newStartsAt;
      }
      if (input.location !== undefined && input.location !== match.location)
        data.location = input.location;
      if (input.capacity !== undefined && input.capacity !== match.capacity)
        data.capacity = input.capacity;

      // Nothing actually changed
      if (Object.keys(data).length === 0) {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      // Detect major change (startsAt, location).
      // Capacity changes are NOT major — they use overflow-to-waitlist instead.
      const isMajorChange =
        data.startsAt !== undefined || data.location !== undefined;

      const capacityDecreased =
        data.capacity !== undefined &&
        (data.capacity as number) < match.capacity;

      // Apply update + increment revision
      data.revision = match.revision + 1;
      await tx.match.update({
        where: { id: input.matchId },
        data,
      });

      if (isMajorChange) {
        // CONFIRMED -> INVITED (reconfirmation), except creator stays CONFIRMED
        await tx.matchParticipant.updateMany({
          where: {
            matchId: input.matchId,
            status: 'CONFIRMED',
            userId: { not: match.createdById },
          },
          data: {
            status: 'INVITED',
            confirmedAt: null,
          },
        });
      }

      // Capacity overflow: move excess confirmed to waitlist (FIFO by confirmedAt)
      if (capacityDecreased && !isMajorChange) {
        const newCapacity = data.capacity as number;
        const confirmed = await tx.matchParticipant.findMany({
          where: { matchId: input.matchId, status: 'CONFIRMED' },
          orderBy: { confirmedAt: 'asc' },
          select: { userId: true },
        });

        if (confirmed.length > newCapacity) {
          // Determine current max waitlist position
          const agg = await tx.matchParticipant.aggregate({
            where: { matchId: input.matchId },
            _max: { waitlistPosition: true },
          });
          let nextPos = (agg._max.waitlistPosition ?? 0) + 1;

          const overflow = confirmed.slice(newCapacity);
          for (const p of overflow) {
            await tx.matchParticipant.update({
              where: {
                matchId_userId: {
                  matchId: input.matchId,
                  userId: p.userId,
                },
              },
              data: {
                status: 'WAITLISTED',
                confirmedAt: null,
                waitlistPosition: nextPos++,
              },
            });
          }
        }
      }

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
