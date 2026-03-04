import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../../push/notification-provider.interface';

const GROUP_ADDED_COOLDOWN_MS = 30 * 60 * 1000; // 30 min

@Injectable()
export class GroupNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider,
  ) {}

  async onMemberAdded(input: {
    groupId: string;
    groupName: string;
    addedUserId: string;
  }): Promise<void> {
    const { groupId, groupName, addedUserId } = input;
    if (!(await this.shouldSend(addedUserId, groupId, 'group_added'))) return;

    await this.provider.sendToUser(addedUserId, {
      title: 'Te agregaron a un grupo',
      body: `Ahora sos miembro de "${groupName}".`,
      data: { type: 'group_added', groupId },
    });

    await this.recordDelivery(addedUserId, groupId, 'group_added');
  }

  private async shouldSend(
    userId: string,
    groupId: string,
    type: string,
  ): Promise<boolean> {
    const since = new Date(Date.now() - GROUP_ADDED_COOLDOWN_MS);
    const existing = await this.prisma.client.notificationDelivery.findFirst({
      where: { userId, groupId, type, createdAt: { gte: since } },
    });
    return existing === null;
  }

  private async recordDelivery(
    userId: string,
    groupId: string,
    type: string,
  ): Promise<void> {
    await this.prisma.client.notificationDelivery.create({
      data: { userId, groupId, type },
    });
  }
}
