import { ListMatchesQuery } from './list-matches.query';
import { PrismaService } from '../../infra/prisma/prisma.service';

const now = new Date('2026-06-01T18:00:00Z');
const later = new Date('2026-06-02T18:00:00Z');

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    title: 'Futbol 5',
    startsAt: now,
    location: 'Cancha Norte',
    capacity: 10,
    status: 'scheduled',
    revision: 1,
    isLocked: false,
    lockedAt: null,
    createdById: 'admin-1',
    updatedAt: now,
    ...overrides,
  };
}

function buildPrisma() {
  const prisma = {
    client: {
      match: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      matchParticipant: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
    },
  } as unknown as PrismaService;

  return prisma;
}

describe('ListMatchesQuery', () => {
  it('returns empty items and correct pageInfo when no matches', async () => {
    const prisma = buildPrisma();
    const query = new ListMatchesQuery(prisma);

    const result = await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.items).toEqual([]);
    expect(result.pageInfo).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it('returns items with confirmedCount and myStatus', async () => {
    const prisma = buildPrisma();
    const match1 = makeMatch({ id: 'match-1', createdById: 'user-1' });
    const match2 = makeMatch({
      id: 'match-2',
      startsAt: later,
      createdById: 'admin-2',
    });

    prisma.client.match.count = jest.fn().mockResolvedValue(2);
    prisma.client.match.findMany = jest
      .fn()
      .mockResolvedValue([match1, match2]);

    // confirmedCount: match-1 has 3 confirmed, match-2 has 0
    prisma.client.matchParticipant.groupBy = jest
      .fn()
      .mockResolvedValue([{ matchId: 'match-1', _count: { _all: 3 } }]);

    // myStatus: user-1 is CONFIRMED in match-1, participant in match-2 as INVITED
    prisma.client.matchParticipant.findMany = jest.fn().mockResolvedValue([
      { matchId: 'match-1', status: 'CONFIRMED' },
      { matchId: 'match-2', status: 'INVITED' },
    ]);

    const query = new ListMatchesQuery(prisma);
    const result = await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(2);

    // match-1: confirmedCount=3, myStatus=CONFIRMED, isMatchAdmin=true
    expect(result.items[0].id).toBe('match-1');
    expect(result.items[0].confirmedCount).toBe(3);
    expect(result.items[0].myStatus).toBe('CONFIRMED');
    expect(result.items[0].isMatchAdmin).toBe(true);

    // match-2: confirmedCount=0, myStatus=INVITED, isMatchAdmin=false
    expect(result.items[1].id).toBe('match-2');
    expect(result.items[1].confirmedCount).toBe(0);
    expect(result.items[1].myStatus).toBe('INVITED');
    expect(result.items[1].isMatchAdmin).toBe(false);
  });

  it('scope=mine: where clause filters by actor participation or ownership', async () => {
    const prisma = buildPrisma();
    const query = new ListMatchesQuery(prisma);

    await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    const countCall = (prisma.client.match.count as jest.Mock).mock.calls[0][0];
    const whereClause = countCall.where;

    // Should have OR condition for createdById and participant
    expect(whereClause.AND).toBeDefined();
    const orClause = whereClause.AND.find((c: Record<string, unknown>) => c.OR);
    expect(orClause.OR).toEqual(
      expect.arrayContaining([
        { createdById: 'user-1' },
        { participants: { some: { userId: 'user-1' } } },
      ]),
    );
  });

  it('pagination: totalPages and hasNextPage computed correctly', async () => {
    const prisma = buildPrisma();
    prisma.client.match.count = jest.fn().mockResolvedValue(25);
    prisma.client.match.findMany = jest
      .fn()
      .mockResolvedValue(
        Array.from({ length: 10 }, (_, i) =>
          makeMatch({ id: `match-${i}`, createdById: 'user-1' }),
        ),
      );

    const query = new ListMatchesQuery(prisma);
    const result = await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 10,
    });

    expect(result.pageInfo.totalItems).toBe(25);
    expect(result.pageInfo.totalPages).toBe(3);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.hasPrevPage).toBe(false);
  });

  it('pagination: page 2 has hasPrevPage=true', async () => {
    const prisma = buildPrisma();
    prisma.client.match.count = jest.fn().mockResolvedValue(25);
    prisma.client.match.findMany = jest
      .fn()
      .mockResolvedValue(
        Array.from({ length: 10 }, (_, i) =>
          makeMatch({ id: `match-${i}`, createdById: 'user-1' }),
        ),
      );

    const query = new ListMatchesQuery(prisma);
    const result = await query.execute({
      actorId: 'user-1',
      page: 2,
      pageSize: 10,
    });

    expect(result.pageInfo.hasPrevPage).toBe(true);
    expect(result.pageInfo.hasNextPage).toBe(true);
  });

  it('date filters are applied to where clause', async () => {
    const prisma = buildPrisma();
    const query = new ListMatchesQuery(prisma);

    await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
      from: '2026-06-01T00:00:00Z',
      to: '2026-06-30T23:59:59Z',
    });

    const countCall = (prisma.client.match.count as jest.Mock).mock.calls[0][0];
    const whereClause = countCall.where;

    const dateClause = whereClause.AND.find(
      (c: Record<string, unknown>) => c.startsAt,
    );
    expect(dateClause.startsAt.gte).toEqual(new Date('2026-06-01T00:00:00Z'));
    expect(dateClause.startsAt.lte).toEqual(new Date('2026-06-30T23:59:59Z'));
  });

  it('default view (upcoming): where clause excludes canceled and played matches', async () => {
    const prisma = buildPrisma();
    const query = new ListMatchesQuery(prisma);

    await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    const countCall = (prisma.client.match.count as jest.Mock).mock.calls[0][0];
    const whereClause = countCall.where;

    // Should have status not canceled
    const statusClause = whereClause.AND.find(
      (c: Record<string, unknown>) => c.status,
    );
    expect(statusClause).toEqual({ status: { not: 'canceled' } });

    // Should have startsAt > playedCutoff (now - 1h) to exclude played matches
    const startsAtClause = whereClause.AND.find(
      (c: Record<string, unknown>) => c.startsAt,
    );
    expect(startsAtClause.startsAt.gt).toBeInstanceOf(Date);
  });

  it('view=upcoming: orders by startsAt asc', async () => {
    const prisma = buildPrisma();
    const query = new ListMatchesQuery(prisma);

    prisma.client.match.count = jest.fn().mockResolvedValue(1);
    prisma.client.match.findMany = jest
      .fn()
      .mockResolvedValue([makeMatch({ createdById: 'user-1' })]);

    await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
      view: 'upcoming',
    });

    const findManyCall = (prisma.client.match.findMany as jest.Mock).mock
      .calls[0][0];
    expect(findManyCall.orderBy).toEqual({ startsAt: 'asc' });
  });

  it('view=history: where clause includes canceled OR played matches', async () => {
    const prisma = buildPrisma();
    const query = new ListMatchesQuery(prisma);

    await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
      view: 'history',
    });

    const countCall = (prisma.client.match.count as jest.Mock).mock.calls[0][0];
    const whereClause = countCall.where;

    // Should have OR clause for canceled or played (startsAt <= now - 1h)
    const historyClause = whereClause.AND.find(
      (c: Record<string, unknown>) => c.OR,
    );
    expect(historyClause.OR).toEqual(
      expect.arrayContaining([
        { status: 'canceled' },
        expect.objectContaining({
          startsAt: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      ]),
    );
  });

  it('view=history: orders by startsAt desc', async () => {
    const prisma = buildPrisma();
    const query = new ListMatchesQuery(prisma);

    prisma.client.match.count = jest.fn().mockResolvedValue(1);
    prisma.client.match.findMany = jest
      .fn()
      .mockResolvedValue([makeMatch({ createdById: 'user-1' })]);

    await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
      view: 'history',
    });

    const findManyCall = (prisma.client.match.findMany as jest.Mock).mock
      .calls[0][0];
    expect(findManyCall.orderBy).toEqual({ startsAt: 'desc' });
  });

  it('items include derived matchStatus field', async () => {
    const prisma = buildPrisma();
    const match1 = makeMatch({ id: 'match-1', createdById: 'user-1' });

    prisma.client.match.count = jest.fn().mockResolvedValue(1);
    prisma.client.match.findMany = jest.fn().mockResolvedValue([match1]);

    const query = new ListMatchesQuery(prisma);
    const result = await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0].matchStatus).toBeDefined();
    expect(['UPCOMING', 'PLAYED', 'CANCELLED']).toContain(
      result.items[0].matchStatus,
    );
  });

  it('myStatus is null when actor has no participation', async () => {
    const prisma = buildPrisma();
    const match1 = makeMatch({ id: 'match-1', createdById: 'user-1' });

    prisma.client.match.count = jest.fn().mockResolvedValue(1);
    prisma.client.match.findMany = jest.fn().mockResolvedValue([match1]);
    // No participations for this user
    prisma.client.matchParticipant.findMany = jest.fn().mockResolvedValue([]);

    const query = new ListMatchesQuery(prisma);
    const result = await query.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0].myStatus).toBeNull();
  });
});
