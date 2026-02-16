import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface GroupSummary {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  createdAt: Date;
}

export interface ListGroupsResult {
  owned: GroupSummary[];
  memberOf: GroupSummary[];
}

@Injectable()
export class ListGroupsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(actorId: string): Promise<ListGroupsResult> {
    const owned = await this.prisma.client.group.findMany({
      where: { ownerId: actorId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const memberOf = await this.prisma.client.group.findMany({
      where: {
        members: { some: { userId: actorId } },
        NOT: { ownerId: actorId },
      },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const toSummary = (g: (typeof owned)[number]): GroupSummary => ({
      id: g.id,
      name: g.name,
      ownerId: g.ownerId,
      memberCount: g._count.members,
      createdAt: g.createdAt,
    });

    return {
      owned: owned.map(toSummary),
      memberOf: memberOf.map(toSummary),
    };
  }
}
