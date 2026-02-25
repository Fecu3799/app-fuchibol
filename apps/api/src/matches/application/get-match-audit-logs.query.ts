import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface GetMatchAuditLogsInput {
  matchId: string;
  actorId: string;
  page: number;
  pageSize: number;
}

interface AuditLogActor {
  id: string;
  username: string;
}

export interface AuditLogItem {
  id: string;
  type: string;
  metadata: Record<string, unknown>;
  actor: AuditLogActor | null;
  createdAt: Date;
}

interface PageInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface GetMatchAuditLogsResult {
  items: AuditLogItem[];
  pageInfo: PageInfo;
}

@Injectable()
export class GetMatchAuditLogsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    input: GetMatchAuditLogsInput,
  ): Promise<GetMatchAuditLogsResult> {
    const { matchId, page, pageSize } = input;
    const skip = (page - 1) * pageSize;

    const totalItems = await this.prisma.client.matchAuditLog.count({
      where: { matchId },
    });

    if (totalItems === 0) {
      return { items: [], pageInfo: buildPageInfo(page, pageSize, 0) };
    }

    const rows = await this.prisma.client.matchAuditLog.findMany({
      where: { matchId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        actor: { select: { id: true, username: true } },
      },
    });

    const items: AuditLogItem[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      metadata: row.metadata as Record<string, unknown>,
      actor: row.actor
        ? { id: row.actor.id, username: row.actor.username }
        : null,
      createdAt: row.createdAt,
    }));

    return { items, pageInfo: buildPageInfo(page, pageSize, totalItems) };
  }
}

function buildPageInfo(
  page: number,
  pageSize: number,
  totalItems: number,
): PageInfo {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
