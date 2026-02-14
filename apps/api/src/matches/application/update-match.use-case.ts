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
  'capacity',
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

      // Detect major change (value actually differs, not just sent).
      // Per CLAUDE.md: startsAt, location, capacity are major fields.
      // Any change to these triggers reconfirmation (CONFIRMED -> INVITED).
      const isMajorChange =
        data.startsAt !== undefined ||
        data.location !== undefined ||
        data.capacity !== undefined;

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

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
