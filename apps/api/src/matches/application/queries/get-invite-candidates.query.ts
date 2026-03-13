import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export type InviteCandidateStatus =
  | 'CONFIRMED'
  | 'INVITED'
  | 'WAITLISTED'
  | 'SPECTATOR'
  | 'NONE';

export interface InviteCandidate {
  userId: string;
  username: string;
  matchStatus: InviteCandidateStatus;
  canInvite: boolean;
  reason?: string;
}

export interface GetInviteCandidatesResult {
  candidates: InviteCandidate[];
}

const REASON: Record<string, string> = {
  CONFIRMED: 'Ya confirmado',
  INVITED: 'Ya invitado',
  WAITLISTED: 'En lista de espera',
  SPECTATOR: 'Es espectador',
  DECLINED: 'Ha declinado',
};

@Injectable()
export class GetInviteCandidatesQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: {
    matchId: string;
    groupId: string;
    actorId: string;
  }): Promise<GetInviteCandidatesResult> {
    const match = await this.prisma.client.match.findUnique({
      where: { id: input.matchId },
    });
    if (!match) throw new NotFoundException('Match not found');

    // Actor must be creator or matchAdmin
    const actorParticipant =
      await this.prisma.client.matchParticipant.findUnique({
        where: {
          matchId_userId: {
            matchId: input.matchId,
            userId: input.actorId,
          },
        },
      });
    const isCreator = match.createdById === input.actorId;
    const isMatchAdmin = actorParticipant?.isMatchAdmin === true;
    if (!isCreator && !isMatchAdmin) {
      throw new ForbiddenException('NOT_MATCH_ADMIN');
    }

    const group = await this.prisma.client.group.findUnique({
      where: { id: input.groupId },
      include: {
        members: {
          include: { user: { select: { username: true } } },
        },
      },
    });
    if (!group) throw new NotFoundException('GROUP_NOT_FOUND');

    const isMember = group.members.some((m) => m.userId === input.actorId);
    if (!isMember && !isCreator) {
      throw new ForbiddenException('NOT_A_MEMBER');
    }

    const memberIds = group.members.map((m) => m.userId);
    const matchParticipants =
      await this.prisma.client.matchParticipant.findMany({
        where: { matchId: input.matchId, userId: { in: memberIds } },
        select: { userId: true, status: true },
      });

    const statusMap = new Map(
      matchParticipants.map((p) => [p.userId, p.status]),
    );

    const candidates: InviteCandidate[] = group.members.map((m) => {
      const rawStatus = statusMap.get(m.userId);
      const matchStatus = (rawStatus ?? 'NONE') as InviteCandidateStatus;
      const canInvite = matchStatus === 'NONE';
      return {
        userId: m.userId,
        username: m.user.username,
        matchStatus,
        canInvite,
        ...(canInvite ? {} : { reason: REASON[matchStatus] }),
      };
    });

    return { candidates };
  }
}
