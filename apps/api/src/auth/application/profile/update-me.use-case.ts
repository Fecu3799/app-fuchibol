import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { UserGender, PreferredPosition, SkillLevel } from '@prisma/client';

export interface UpdateMeInput {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  gender?: UserGender | null;
  preferredPosition?: PreferredPosition | null;
  skillLevel?: SkillLevel | null;
}

@Injectable()
export class UpdateMeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateMeInput) {
    const { userId, birthDate, ...rest } = input;

    const existing = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        ...rest,
        ...(birthDate !== undefined
          ? { birthDate: birthDate ? new Date(birthDate) : null }
          : {}),
      },
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
        createdAt: true,
      },
    });

    return user;
  }
}
