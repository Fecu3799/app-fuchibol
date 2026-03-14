import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class UnbanUserUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { bannedAt: null, banReason: null },
    });

    return { banned: false };
  }
}
