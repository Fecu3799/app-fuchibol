import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';

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
  'capacity',
];

@Injectable()
export class UpdateMatchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateMatchInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.createdById !== input.actorId) {
        throw new ForbiddenException('Only match admin can update');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      // Build data to update
      const data: Record<string, unknown> = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.startsAt !== undefined)
        data.startsAt = new Date(input.startsAt);
      if (input.location !== undefined) data.location = input.location;
      if (input.capacity !== undefined) data.capacity = input.capacity;

      // Nothing to update
      if (Object.keys(data).length === 0) {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      // Detect major change
      const isMajorChange = MAJOR_CHANGE_FIELDS.some(
        (f) => input[f] !== undefined,
      );

      // Capacity validation: cannot reduce below current confirmed count
      if (input.capacity !== undefined) {
        const confirmedCount = await tx.matchParticipant.count({
          where: { matchId: input.matchId, status: 'CONFIRMED' },
        });
        if (input.capacity < confirmedCount) {
          throw new ConflictException(
            'CAPACITY_BELOW_CONFIRMED: cannot reduce capacity below current confirmed count',
          );
        }
      }

      // Apply update + increment revision
      data.revision = match.revision + 1;
      await tx.match.update({
        where: { id: input.matchId },
        data,
      });

      if (isMajorChange) {
        // CONFIRMED -> INVITED (reconfirmation)
        await tx.matchParticipant.updateMany({
          where: { matchId: input.matchId, status: 'CONFIRMED' },
          data: {
            status: 'INVITED',
            confirmedAt: null,
          },
        });

        // WAITLISTED, INVITED, DECLINED, WITHDRAWN stay as-is
      }

      // If capacity increased, promote from waitlist
      if (
        input.capacity !== undefined &&
        input.capacity > match.capacity &&
        !isMajorChange
      ) {
        // Only auto-promote when it's NOT a major change (major change already reset confirmed to invited)
        await this.promoteWaitlist(tx, input.matchId, input.capacity);
      }

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }

  private async promoteWaitlist(
    tx: Parameters<Parameters<PrismaService['client']['$transaction']>[0]>[0],
    matchId: string,
    capacity: number,
  ): Promise<void> {
    const confirmedCount = await tx.matchParticipant.count({
      where: { matchId, status: 'CONFIRMED' },
    });

    const slotsAvailable = capacity - confirmedCount;
    if (slotsAvailable <= 0) return;

    const toPromote = await tx.matchParticipant.findMany({
      where: { matchId, status: 'WAITLISTED' },
      orderBy: { waitlistPosition: 'asc' },
      take: slotsAvailable,
    });

    for (const p of toPromote) {
      await tx.matchParticipant.update({
        where: { id: p.id },
        data: {
          status: 'CONFIRMED',
          waitlistPosition: null,
          confirmedAt: new Date(),
        },
      });
    }
  }
}
