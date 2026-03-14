import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface ListAdminMatchesInput {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ListAdminMatchesQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListAdminMatchesInput) {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (input.status) where.status = input.status;
    if (input.dateFrom || input.dateTo) {
      where.startsAt = {
        ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
        ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
      };
    }

    const [total, matches] = await Promise.all([
      this.prisma.client.match.count({ where }),
      this.prisma.client.match.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { startsAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          isLocked: true,
          startsAt: true,
          capacity: true,
          revision: true,
          createdAt: true,
          createdBy: { select: { id: true, username: true } },
          _count: { select: { participants: true } },
        },
      }),
    ]);

    return {
      items: matches,
      pageInfo: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }
}
