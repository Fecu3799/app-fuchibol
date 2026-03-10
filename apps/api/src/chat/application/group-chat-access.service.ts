import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class GroupChatAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async checkAccess(groupId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.client.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { groupId: true },
    });
    return member !== null;
  }
}
