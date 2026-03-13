import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetInviteCandidatesQuery } from './get-invite-candidates.query';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const MATCH_ID = 'match-1';
const GROUP_ID = 'group-1';
const ACTOR_ID = 'actor-1';
const MEMBER_ID = 'member-1';
const MEMBER2_ID = 'member-2';

const mockMatch = {
  id: MATCH_ID,
  createdById: ACTOR_ID,
  status: 'scheduled',
  revision: 1,
};

const mockGroup = {
  id: GROUP_ID,
  members: [
    { userId: ACTOR_ID, user: { username: 'actor' } },
    { userId: MEMBER_ID, user: { username: 'member1' } },
    { userId: MEMBER2_ID, user: { username: 'member2' } },
  ],
};

function buildPrisma(overrides: Record<string, unknown> = {}) {
  const prisma = {
    client: {
      match: {
        findUnique: jest.fn().mockResolvedValue(mockMatch),
      },
      matchParticipant: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      group: {
        findUnique: jest.fn().mockResolvedValue(mockGroup),
      },
      ...overrides,
    },
  } as unknown as PrismaService;
  return prisma;
}

describe('GetInviteCandidatesQuery', () => {
  it('returns NONE for all group members not in match', async () => {
    const prisma = buildPrisma();
    const query = new GetInviteCandidatesQuery(prisma);

    const result = await query.execute({
      matchId: MATCH_ID,
      groupId: GROUP_ID,
      actorId: ACTOR_ID,
    });

    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.every((c) => c.matchStatus === 'NONE')).toBe(true);
    expect(result.candidates.every((c) => c.canInvite === true)).toBe(true);
  });

  it('marks INVITED member as canInvite=false', async () => {
    const prisma = buildPrisma();
    (prisma.client.matchParticipant.findMany as jest.Mock).mockResolvedValue([
      { userId: MEMBER_ID, status: 'INVITED' },
    ]);
    const query = new GetInviteCandidatesQuery(prisma);

    const result = await query.execute({
      matchId: MATCH_ID,
      groupId: GROUP_ID,
      actorId: ACTOR_ID,
    });

    const member = result.candidates.find((c) => c.userId === MEMBER_ID);
    expect(member?.matchStatus).toBe('INVITED');
    expect(member?.canInvite).toBe(false);
    expect(member?.reason).toBeDefined();
  });

  it('marks CONFIRMED member as canInvite=false', async () => {
    const prisma = buildPrisma();
    (prisma.client.matchParticipant.findMany as jest.Mock).mockResolvedValue([
      { userId: MEMBER2_ID, status: 'CONFIRMED' },
    ]);
    const query = new GetInviteCandidatesQuery(prisma);

    const result = await query.execute({
      matchId: MATCH_ID,
      groupId: GROUP_ID,
      actorId: ACTOR_ID,
    });

    const member = result.candidates.find((c) => c.userId === MEMBER2_ID);
    expect(member?.matchStatus).toBe('CONFIRMED');
    expect(member?.canInvite).toBe(false);
  });

  it('throws ForbiddenException NOT_MATCH_ADMIN if actor is not creator or matchAdmin', async () => {
    const nonAdminMatch = { ...mockMatch, createdById: 'other-user' };
    const prisma = buildPrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue(
      nonAdminMatch,
    );
    // actor has no participant row (findUnique returns null by default)
    const query = new GetInviteCandidatesQuery(prisma);

    await expect(
      query.execute({
        matchId: MATCH_ID,
        groupId: GROUP_ID,
        actorId: ACTOR_ID,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException GROUP_NOT_FOUND if group does not exist', async () => {
    const prisma = buildPrisma();
    (prisma.client.group.findUnique as jest.Mock).mockResolvedValue(null);
    const query = new GetInviteCandidatesQuery(prisma);

    await expect(
      query.execute({
        matchId: MATCH_ID,
        groupId: GROUP_ID,
        actorId: ACTOR_ID,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException NOT_A_MEMBER if actor is not in group (non-creator)', async () => {
    const nonCreatorMatch = { ...mockMatch, createdById: 'someone-else' };
    const prisma = buildPrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue(
      nonCreatorMatch,
    );
    // actor is a matchAdmin participant
    (prisma.client.matchParticipant.findUnique as jest.Mock).mockResolvedValue({
      userId: ACTOR_ID,
      isMatchAdmin: true,
      status: 'CONFIRMED',
    });
    // group does not include actor
    const groupWithoutActor = {
      ...mockGroup,
      members: [{ userId: MEMBER_ID, user: { username: 'member1' } }],
    };
    (prisma.client.group.findUnique as jest.Mock).mockResolvedValue(
      groupWithoutActor,
    );
    const query = new GetInviteCandidatesQuery(prisma);

    await expect(
      query.execute({
        matchId: MATCH_ID,
        groupId: GROUP_ID,
        actorId: ACTOR_ID,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
