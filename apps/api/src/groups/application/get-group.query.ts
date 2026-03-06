import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

export interface GroupMemberView {
  userId: string;
  username: string;
  avatarUrl: string | null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async execute(groupId: string, actorId: string): Promise<GroupDetail> {
    const group = await this.prisma.client.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                username: true,
                avatar: { select: { key: true } },
              },
            },
          },
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
        avatarUrl: m.user.avatar?.key
          ? this.storage.buildPublicUrl(m.user.avatar.key)
          : null,
        createdAt: m.createdAt,
      })),
      createdAt: group.createdAt,
    };
  }
}
