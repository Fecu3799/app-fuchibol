import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface GroupMemberView {
  userId: string;
  username: string;
  createdAt: Date;
}

export interface GroupDetail {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  members: GroupMemberView[];
  createdAt: Date;
}

@Injectable()
export class GetGroupQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(groupId: string, actorId: string): Promise<GroupDetail> {
    const group = await this.prisma.client.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: { select: { username: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('GROUP_NOT_FOUND');
    }

    const isMember = group.members.some((m) => m.userId === actorId);
    if (!isMember) {
      throw new ForbiddenException('NOT_A_MEMBER');
    }

    return {
      id: group.id,
      name: group.name,
      ownerId: group.ownerId,
      memberCount: group.members.length,
      members: group.members.map((m) => ({
        userId: m.userId,
        username: m.user.username,
        createdAt: m.createdAt,
      })),
      createdAt: group.createdAt,
    };
  }
}
