import { Injectable } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { computeMatchStatusView } from '../domain/compute-match-status-view';
import type { MatchStatusView } from '../domain/compute-match-status-view';

export interface ListMatchesInput {
  actorId: string;
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  view?: 'upcoming' | 'history';
}

export interface MatchHomeItem {
  id: string;
  title: string;
  startsAt: Date;
  location: string | null;
  capacity: number;
  status: string;
  matchStatus: MatchStatusView;
  revision: number;
  isLocked: boolean;
  lockedAt: Date | null;
  confirmedCount: number;
  myStatus: string | null;
  isMatchAdmin: boolean;
  updatedAt: Date;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ListMatchesResult {
  items: MatchHomeItem[];
  pageInfo: PageInfo;
}

@Injectable()
export class ListMatchesQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListMatchesInput): Promise<ListMatchesResult> {
    const { actorId, page, pageSize, from, to, view = 'upcoming' } = input;
    const skip = (page - 1) * pageSize;
    const now = new Date();
    const playedCutoff = new Date(now.getTime() - 60 * 60 * 1000);

    // Build where clause: scope=mine (matches where actor participates OR is creator)
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const startsAtFilter =
      Object.keys(dateFilter).length > 0 ? dateFilter : undefined;

    // View filtering
    // upcoming: not canceled AND not played (startsAt > now - 1h)
    // history: canceled OR played (startsAt <= now - 1h)
    const viewFilter =
      view === 'history'
        ? [
            {
              OR: [
                { status: MatchStatus.canceled },
                { startsAt: { lte: playedCutoff } },
              ],
            },
          ]
        : [
            { status: { not: MatchStatus.canceled } },
            { startsAt: { gt: playedCutoff } },
          ];

    const where = {
      AND: [
        ...(startsAtFilter ? [{ startsAt: startsAtFilter }] : []),
        ...viewFilter,
        {
          OR: [
            { createdById: actorId },
            { participants: { some: { userId: actorId } } },
          ],
        },
      ],
    };

    // 1) Count total for pagination
    const totalItems = await this.prisma.client.match.count({ where });

    if (totalItems === 0) {
      return {
        items: [],
        pageInfo: buildPageInfo(page, pageSize, 0),
      };
    }

    // 2) Fetch paginated match rows
    const matches = await this.prisma.client.match.findMany({
      where,
      orderBy: { startsAt: view === 'history' ? 'desc' : 'asc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        title: true,
        startsAt: true,
        location: true,
        capacity: true,
        status: true,
        revision: true,
        isLocked: true,
        lockedAt: true,
        createdById: true,
        updatedAt: true,
      },
    });

    const matchIds = matches.map((m) => m.id);

    // 3) Batch: confirmedCount per match (single groupBy query)
    const confirmedCounts = await this.prisma.client.matchParticipant.groupBy({
      by: ['matchId'],
      where: { matchId: { in: matchIds }, status: 'CONFIRMED' },
      _count: { _all: true },
    });

    const confirmedMap = new Map(
      confirmedCounts.map((c) => [c.matchId, c._count._all]),
    );

    // 4) Batch: actor's participation per match (single query)
    const myParticipations = await this.prisma.client.matchParticipant.findMany(
      {
        where: { matchId: { in: matchIds }, userId: actorId },
        select: { matchId: true, status: true },
      },
    );

    const myStatusMap = new Map(
      myParticipations.map((p) => [p.matchId, p.status]),
    );

    // 5) Map to MatchHomeItem
    const items: MatchHomeItem[] = matches.map((m) => ({
      id: m.id,
      title: m.title,
      startsAt: m.startsAt,
      location: m.location,
      capacity: m.capacity,
      status: m.status,
      matchStatus: computeMatchStatusView(m, now),
      revision: m.revision,
      isLocked: m.isLocked,
      lockedAt: m.lockedAt,
      confirmedCount: confirmedMap.get(m.id) ?? 0,
      myStatus: myStatusMap.get(m.id) ?? null,
      isMatchAdmin: m.createdById === actorId,
      updatedAt: m.updatedAt,
    }));

    return {
      items,
      pageInfo: buildPageInfo(page, pageSize, totalItems),
    };
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
