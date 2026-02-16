import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AddMemberUseCase } from './add-member.use-case';
import { GetGroupQuery } from './get-group.query';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockGroup = {
  id: 'group-1',
  name: 'Test Group',
  ownerId: 'owner-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockGroupDetail = {
  id: 'group-1',
  name: 'Test Group',
  ownerId: 'owner-1',
  memberCount: 2,
  members: [],
  createdAt: new Date(),
};

function buildMocks() {
  const mocks = {
    groupFindUnique: jest.fn().mockResolvedValue(mockGroup),
    memberFindUnique: jest.fn().mockResolvedValue(null),
    memberCreate: jest
      .fn()
      .mockResolvedValue({ groupId: 'group-1', userId: 'user-2' }),
    userFindFirst: jest
      .fn()
      .mockResolvedValue({ id: 'user-2', username: 'bob' }),
  };

  const prisma = {
    client: {
      group: { findUnique: mocks.groupFindUnique },
      groupMember: {
        findUnique: mocks.memberFindUnique,
        create: mocks.memberCreate,
      },
      user: { findFirst: mocks.userFindFirst },
    },
  } as unknown as PrismaService;

  return { prisma, mocks };
}

function buildGetGroupQuery() {
  return {
    execute: jest.fn().mockResolvedValue(mockGroupDetail),
  } as unknown as GetGroupQuery;
}

describe('AddMemberUseCase', () => {
  it('throws 404 when group not found', async () => {
    const { prisma, mocks } = buildMocks();
    mocks.groupFindUnique.mockResolvedValue(null);
    const getGroupQuery = buildGetGroupQuery();
    const useCase = new AddMemberUseCase(prisma, getGroupQuery);

    await expect(
      useCase.execute({
        groupId: 'group-1',
        actorId: 'owner-1',
        identifier: 'bob',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 403 when actor is not owner', async () => {
    const { prisma } = buildMocks();
    const getGroupQuery = buildGetGroupQuery();
    const useCase = new AddMemberUseCase(prisma, getGroupQuery);

    await expect(
      useCase.execute({
        groupId: 'group-1',
        actorId: 'user-99',
        identifier: 'bob',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws 409 ALREADY_MEMBER when user is already member', async () => {
    const { prisma, mocks } = buildMocks();
    mocks.memberFindUnique.mockResolvedValue({
      groupId: 'group-1',
      userId: 'user-2',
    });
    const getGroupQuery = buildGetGroupQuery();
    const useCase = new AddMemberUseCase(prisma, getGroupQuery);

    await expect(
      useCase.execute({
        groupId: 'group-1',
        actorId: 'owner-1',
        identifier: 'bob',
      }),
    ).rejects.toThrow('ALREADY_MEMBER');
  });

  it('adds member successfully', async () => {
    const { prisma, mocks } = buildMocks();
    const getGroupQuery = buildGetGroupQuery();
    const useCase = new AddMemberUseCase(prisma, getGroupQuery);

    const result = await useCase.execute({
      groupId: 'group-1',
      actorId: 'owner-1',
      identifier: 'bob',
    });

    expect(mocks.memberCreate).toHaveBeenCalledWith({
      data: { groupId: 'group-1', userId: 'user-2' },
    });
    expect(result).toEqual(mockGroupDetail);
  });
});
