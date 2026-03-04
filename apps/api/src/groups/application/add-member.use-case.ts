import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { resolveUser } from '../../common/helpers/resolve-user.helper';
import { GetGroupQuery } from './get-group.query';
import type { GroupDetail } from './get-group.query';
import { GroupNotificationService } from './group-notification.service';

export interface AddMemberInput {
  groupId: string;
  actorId: string;
  identifier: string;
}

@Injectable()
export class AddMemberUseCase {
  private readonly logger = new Logger(AddMemberUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly getGroupQuery: GetGroupQuery,
    private readonly groupNotification: GroupNotificationService,
  ) {}

  async execute(input: AddMemberInput): Promise<GroupDetail> {
    const group = await this.prisma.client.group.findUnique({
      where: { id: input.groupId },
    });

    if (!group) {
      throw new NotFoundException('GROUP_NOT_FOUND');
    }

    if (group.ownerId !== input.actorId) {
      throw new ForbiddenException('ONLY_OWNER_CAN_ADD');
    }

    const targetUserId = await resolveUser(this.prisma.client, {
      identifier: input.identifier,
    });

    const existing = await this.prisma.client.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: input.groupId,
          userId: targetUserId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('ALREADY_MEMBER');
    }

    await this.prisma.client.groupMember.create({
      data: {
        groupId: input.groupId,
        userId: targetUserId,
      },
    });

    const result = await this.getGroupQuery.execute(
      input.groupId,
      input.actorId,
    );

    void this.groupNotification
      .onMemberAdded({
        groupId: input.groupId,
        groupName: group.name,
        addedUserId: targetUserId,
      })
      .catch((err: unknown) =>
        this.logger.warn('[GroupNotification] onMemberAdded failed', { err }),
      );

    return result;
  }
}
