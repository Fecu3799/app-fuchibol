import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface BanUserInput {
  userId: string;
  reason: string;
}

@Injectable()
export class BanUserUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: BanUserInput) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.client.user.update({
      where: { id: input.userId },
      data: { bannedAt: new Date(), banReason: input.reason },
    });

    return { banned: true };
  }
}
