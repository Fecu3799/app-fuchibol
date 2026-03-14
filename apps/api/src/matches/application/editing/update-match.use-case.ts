import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { MatchSnapshot } from '../shared/match-snapshot.service';
import { MatchSnapshotService } from '../shared/match-snapshot.service';
import { lockMatchRow } from '../shared/lock-match-row';
import { MatchAuditService, AuditLogType } from '../audit/match-audit.service';
import { MatchNotificationService } from '../notifications/match-notification.service';
import type {
  VenueSnapshot,
  PitchSnapshot,
} from '../shared/match-snapshot.service';
import { MetricsService } from '../../../metrics/metrics.service';

export interface UpdateMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  title?: string;
  startsAt?: string;
  location?: string;
  capacity?: number;
  venueId?: string;
  venuePitchId?: string;
}

@Injectable()
export class UpdateMatchUseCase {
  private readonly logger = new Logger(UpdateMatchUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: MatchSnapshotService,
    private readonly audit: MatchAuditService,
    private readonly matchNotification: MatchNotificationService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async execute(input: UpdateMatchInput): Promise<MatchSnapshot> {
    // Validate that venueId and venuePitchId are provided together
    const hasVenue = input.venueId !== undefined;
    const hasPitch = input.venuePitchId !== undefined;
    if (hasVenue !== hasPitch) {
      throw new UnprocessableEntityException(
        'venueId and venuePitchId must both be provided together',
      );
    }

    // Pre-fetch and validate venue/pitch before entering the transaction
    let newVenueSnapshot: VenueSnapshot | undefined;
    let newPitchSnapshot: PitchSnapshot | undefined;

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

      newVenueSnapshot = {
        name: pitch.venue.name,
        addressText: pitch.venue.addressText,
        mapsUrl: pitch.venue.mapsUrl,
        latitude: pitch.venue.latitude,
        longitude: pitch.venue.longitude,
      };
      newPitchSnapshot = {
        name: pitch.name,
        pitchType: pitch.pitchType,
        price: pitch.price,
      };
    }

    let reconfirmUserIds: string[] = [];

    const snapshot = await this.prisma.client.$transaction(async (tx) => {
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

      if (['canceled', 'in_progress', 'played'].includes(match.status)) {
        throw new ConflictException('MATCH_CANCELLED');
      }

      if (match.revision !== input.expectedRevision) {
        this.logger.warn({
          op: 'updateMatch',
          matchId: input.matchId,
          actorUserId: input.actorId,
          msg: 'revision_conflict',
          expected: input.expectedRevision,
          actual: match.revision,
        });
        this.metrics?.incCounter('match_revision_conflicts_total');
        throw new ConflictException('REVISION_CONFLICT');
      }

      const minutesToStart = (match.startsAt.getTime() - Date.now()) / 60_000;
      if (minutesToStart <= 60) {
        throw new UnprocessableEntityException('MATCH_EDIT_FROZEN');
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

      // Venue/pitch update — only if pitch actually changed
      if (
        newVenueSnapshot &&
        newPitchSnapshot &&
        input.venuePitchId !== match.venuePitchId
      ) {
        data.venueId = input.venueId;
        data.venuePitchId = input.venuePitchId;
        data.venueSnapshot =
          newVenueSnapshot as unknown as Prisma.InputJsonObject;
        data.pitchSnapshot =
          newPitchSnapshot as unknown as Prisma.InputJsonObject;
      }

      // Nothing actually changed
      if (Object.keys(data).length === 0) {
        return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
      }

      const capacityDecreased =
        data.capacity !== undefined &&
        (data.capacity as number) < match.capacity;

      // Detect major change (startsAt, location, capacity reduction, or venue change).
      const isMajorChange =
        data.startsAt !== undefined ||
        data.location !== undefined ||
        capacityDecreased ||
        data.venueId !== undefined;

      // Apply update + increment revision
      data.revision = match.revision + 1;
      await tx.match.update({
        where: { id: input.matchId },
        data,
      });

      if (isMajorChange) {
        // Capture confirmed user IDs before resetting them (for post-commit notifications)
        const confirmedRows = await tx.matchParticipant.findMany({
          where: {
            matchId: input.matchId,
            status: 'CONFIRMED',
            userId: { not: match.createdById },
          },
          select: { userId: true },
        });
        reconfirmUserIds = confirmedRows.map((r) => r.userId);

        // CONFIRMED -> INVITED (reconfirmation), except creator stays CONFIRMED
        const reconfirmResult = await tx.matchParticipant.updateMany({
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

        await this.audit.log(
          tx,
          input.matchId,
          input.actorId,
          AuditLogType.MATCH_UPDATED_MAJOR,
          {
            fieldsChanged: Object.keys(data).filter((k) => k !== 'revision'),
            reconfirmationCount: reconfirmResult.count,
          },
        );

        this.logger.log({
          op: 'majorChangeTriggered',
          matchId: input.matchId,
          actorUserId: input.actorId,
          previousStartsAt: match.startsAt.toISOString(),
          newStartsAt: data.startsAt
            ? (data.startsAt as Date).toISOString()
            : match.startsAt.toISOString(),
          previousCapacity: match.capacity,
          newCapacity:
            data.capacity !== undefined
              ? (data.capacity as number)
              : match.capacity,
          affectedParticipantsCount: reconfirmResult.count,
        });

        if (capacityDecreased) {
          this.logger.log({
            op: 'capacityReduced',
            matchId: input.matchId,
            actorUserId: input.actorId,
            oldCapacity: match.capacity,
            newCapacity: data.capacity as number,
            demotedUserIds: reconfirmUserIds,
            demotedCount: reconfirmResult.count,
          });
        }

        // Major change invalidates teams entirely: slot structure may no longer match
        // new capacity, and confirmed players have changed. Drop all slots so the
        // creator reassigns cleanly.
        if (match.teamsConfigured) {
          await tx.matchTeamSlot.deleteMany({
            where: { matchId: input.matchId },
          });
          data.teamsConfigured = false;
          await this.audit.log(
            tx,
            input.matchId,
            input.actorId,
            AuditLogType.TEAMS_RESET,
            { reason: 'major_change' },
          );
        }
      }

      return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
    });

    this.logger.log({
      op: 'updateMatch',
      matchId: input.matchId,
      actorUserId: input.actorId,
      isMajorChange: reconfirmUserIds.length > 0,
      reconfirmCount: reconfirmUserIds.length,
    });
    if (reconfirmUserIds.length > 0) {
      this.metrics?.incCounter('match_major_changes_total');
    }

    if (reconfirmUserIds.length > 0) {
      void this.matchNotification
        .onReconfirmRequired({
          matchId: input.matchId,
          matchTitle: snapshot.title,
          userIds: reconfirmUserIds,
        })
        .catch((err: unknown) =>
          this.logger.warn(
            `[MatchNotification] onReconfirmRequired failed: ${(err as Error)?.message}`,
            { matchId: input.matchId },
          ),
        );
    }

    return snapshot;
  }
}
