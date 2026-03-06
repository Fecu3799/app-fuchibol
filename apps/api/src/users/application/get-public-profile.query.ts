import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { computeReliabilityLabel } from '../../matches/application/user-reliability.service';
import { calculateAge } from '../../common/utils/calculate-age';

export interface PublicProfileView {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  gender: string | null;
  preferredPosition: string | null;
  skillLevel: string | null;
  reliabilityScore: number;
  reliabilityLabel: string;
}

@Injectable()
export class GetPublicProfileQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async execute(targetUserId: string): Promise<PublicProfileView> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        gender: true,
        preferredPosition: true,
        skillLevel: true,
        reliabilityScore: true,
        avatar: { select: { key: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    return {
      id: user.id,
      username: user.username ?? null,
      avatarUrl: user.avatar?.key
        ? this.storage.buildPublicUrl(user.avatar.key)
        : null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      age: calculateAge(user.birthDate ?? null),
      gender: user.gender ?? null,
      preferredPosition: user.preferredPosition ?? null,
      skillLevel: user.skillLevel ?? null,
      reliabilityScore: user.reliabilityScore,
      reliabilityLabel: computeReliabilityLabel(user.reliabilityScore),
    };
  }
}
