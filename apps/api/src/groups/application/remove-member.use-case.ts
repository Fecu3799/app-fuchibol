import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface RemoveMemberInput {
  groupId: string;
  targetUserId: string;
  actorId: string;
}

@Injectable()
export class RemoveMemberUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: RemoveMemberInput): Promise<void> {
    const group = await this.prisma.client.group.findUnique({
      where: { id: input.groupId },
    });

    if (!group) {
      throw new NotFoundException('GROUP_NOT_FOUND');
    }

    const isOwner = group.ownerId === input.actorId;
    const isSelf = input.targetUserId === input.actorId;

    // Owner cannot leave their own group
    if (isOwner && isSelf) {
      throw new ConflictException('OWNER_CANNOT_LEAVE');
    }

    // Non-owner can only remove themselves
    if (!isOwner && !isSelf) {
      throw new ForbiddenException('ONLY_OWNER_CAN_REMOVE');
    }

    const member = await this.prisma.client.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: input.groupId,
          userId: input.targetUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('MEMBER_NOT_FOUND');
    }

    await this.prisma.client.groupMember.delete({
      where: {
        groupId_userId: {
          groupId: input.groupId,
          userId: input.targetUserId,
        },
      },
    });
  }
}
