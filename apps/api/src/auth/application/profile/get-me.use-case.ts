import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { StorageService } from '../../../infra/storage/storage.service';
import { computeReliabilityLabel } from '../../../matches/application/shared/user-reliability.service';
import { calculateAge } from '../../../common/utils/calculate-age';

@Injectable()
export class GetMeUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async execute(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        gender: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        preferredPosition: true,
        skillLevel: true,
        termsAcceptedAt: true,
        reliabilityScore: true,
        suspendedUntil: true,
        createdAt: true,
        avatar: { select: { key: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { avatar, ...rest } = user;
    return {
      ...rest,
      age: calculateAge(user.birthDate ?? null),
      avatarUrl: avatar ? this.storage.buildPublicUrl(avatar.key) : null,
      reliabilityLabel: computeReliabilityLabel(user.reliabilityScore),
    };
  }
}
