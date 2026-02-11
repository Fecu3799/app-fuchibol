import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface MatchSnapshot {
  id: string;
  title: string;
  startsAt: Date;
  capacity: number;
  status: string;
  revision: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class GetMatchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(matchId: string): Promise<MatchSnapshot> {
    const match = await this.prisma.client.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }
}
