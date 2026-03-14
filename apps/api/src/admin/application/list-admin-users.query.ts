import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface ListAdminUsersInput {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ListAdminUsersQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListAdminUsersInput) {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (input.search) {
      where.OR = [
        { email: { contains: input.search, mode: 'insensitive' } },
        { username: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    if (input.status === 'banned') {
      where.bannedAt = { not: null };
    } else if (input.status === 'suspended') {
      where.suspendedUntil = { gt: new Date() };
    } else if (input.status === 'active') {
      where.bannedAt = null;
      where.suspendedUntil = null;
    }

    const [total, users] = await Promise.all([
      this.prisma.client.user.count({ where }),
      this.prisma.client.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          createdAt: true,
          bannedAt: true,
          banReason: true,
          suspendedUntil: true,
          emailVerifiedAt: true,
          reliabilityScore: true,
        },
      }),
    ]);

    return {
      items: users,
      pageInfo: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }
}
