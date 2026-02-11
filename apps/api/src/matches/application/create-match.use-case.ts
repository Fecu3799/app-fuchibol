import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface CreateMatchInput {
  title: string;
  startsAt: string;
  capacity: number;
  createdById: string;
}

export interface CreateMatchResult {
  id: string;
  revision: number;
  status: string;
}

@Injectable()
export class CreateMatchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateMatchInput): Promise<CreateMatchResult> {
    if (input.capacity <= 0) {
      throw new UnprocessableEntityException(
        'capacity must be greater than zero',
      );
    }

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new UnprocessableEntityException(
        'startsAt must be a valid ISO date',
      );
    }

    const minimumStart = Date.now() + 60 * 1000;
    if (startsAt.getTime() < minimumStart) {
      throw new UnprocessableEntityException(
        'startsAt must be at least 1 minute in the future',
      );
    }

    await this.prisma.client.user.upsert({
      where: { id: input.createdById },
      update: {},
      create: { id: input.createdById },
    });

    return this.prisma.client.match.create({
      data: {
        title: input.title,
        startsAt,
        capacity: input.capacity,
        status: MatchStatus.scheduled,
        revision: 1,
        createdById: input.createdById,
      },
      select: {
        id: true,
        revision: true,
        status: true,
      },
    });
  }
}
