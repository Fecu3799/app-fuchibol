import {
  Injectable,
  Logger,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Prisma, MatchStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { MetricsService } from '../../../metrics/metrics.service';
import type {
  VenueSnapshot,
  PitchSnapshot,
} from '../shared/match-snapshot.service';

export interface CreateMatchInput {
  title: string;
  startsAt: string;
  capacity: number;
  createdById: string;
  venueId?: string;
  venuePitchId?: string;
}

export interface CreateMatchResult {
  id: string;
  revision: number;
  status: string;
}

@Injectable()
export class CreateMatchUseCase {
  private readonly logger = new Logger(CreateMatchUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async execute(input: CreateMatchInput): Promise<CreateMatchResult> {
    if (input.capacity <= 0) {
      throw new UnprocessableEntityException(
        'capacity must be greater than zero',
      );
    }

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new UnprocessableEntityException(
        'startsAt must be a valid ISO date',
      );
    }

    const minimumStart = Date.now() + 60 * 1000;
    if (startsAt.getTime() < minimumStart) {
      throw new UnprocessableEntityException(
        'startsAt must be at least 1 minute in the future',
      );
    }

    const hasVenue = !!input.venueId;
    const hasPitch = !!input.venuePitchId;
    if (hasVenue !== hasPitch) {
      throw new UnprocessableEntityException(
        'venueId and venuePitchId must both be provided together',
      );
    }

    let venueSnapshot: VenueSnapshot | undefined;
    let pitchSnapshot: PitchSnapshot | undefined;

    if (input.venueId && input.venuePitchId) {
      const pitch = await this.prisma.client.venuePitch.findUnique({
        where: { id: input.venuePitchId },
        include: {
          venue: {
            select: {
              id: true,
              name: true,
              addressText: true,
              mapsUrl: true,
              latitude: true,
              longitude: true,
              isActive: true,
            },
          },
        },
      });

      if (!pitch) {
        throw new UnprocessableEntityException('Pitch not found');
      }

      if (!pitch.isActive || !pitch.venue.isActive) {
        throw new UnprocessableEntityException(
          'Selected pitch or venue is not available',
        );
      }

      if (pitch.venueId !== input.venueId) {
        throw new UnprocessableEntityException(
          'venuePitchId does not belong to the provided venueId',
        );
      }

      venueSnapshot = {
        name: pitch.venue.name,
        addressText: pitch.venue.addressText,
        mapsUrl: pitch.venue.mapsUrl,
        latitude: pitch.venue.latitude,
        longitude: pitch.venue.longitude,
      };

      pitchSnapshot = {
        name: pitch.name,
        pitchType: pitch.pitchType,
        price: pitch.price,
      };
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      const match = await tx.match.create({
        data: {
          title: input.title,
          startsAt,
          capacity: input.capacity,
          status: MatchStatus.scheduled,
          revision: 1,
          createdById: input.createdById,
          venueId: input.venueId,
          venuePitchId: input.venuePitchId,
          ...(venueSnapshot
            ? {
                venueSnapshot:
                  venueSnapshot as unknown as Prisma.InputJsonObject,
                pitchSnapshot:
                  pitchSnapshot as unknown as Prisma.InputJsonObject,
              }
            : {}),
        },
        select: {
          id: true,
          revision: true,
          status: true,
        },
      });

      await tx.conversation.create({
        data: { type: 'MATCH', matchId: match.id },
      });

      return match;
    });

    this.logger.log({
      op: 'createMatch',
      matchId: result.id,
      actorUserId: input.createdById,
      capacity: input.capacity,
      hasVenue: !!input.venueId,
    });
    this.metrics?.incCounter('match_created_total');

    return result;
  }
}
