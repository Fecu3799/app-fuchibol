import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RemoveMemberUseCase } from './remove-member.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockGroup = {
  id: 'group-1',
  name: 'Test Group',
  ownerId: 'owner-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildMocks() {
  const mocks = {
    groupFindUnique: jest.fn().mockResolvedValue(mockGroup),
    memberFindUnique: jest
      .fn()
      .mockResolvedValue({ groupId: 'group-1', userId: 'user-2' }),
    memberDelete: jest.fn().mockResolvedValue({}),
  };

  const prisma = {
    client: {
      group: { findUnique: mocks.groupFindUnique },
      groupMember: {
        findUnique: mocks.memberFindUnique,
        delete: mocks.memberDelete,
      },
    },
  } as unknown as PrismaService;

  return { prisma, mocks };
}

describe('RemoveMemberUseCase', () => {
  it('owner removes another member successfully', async () => {
    const { prisma, mocks } = buildMocks();
    const useCase = new RemoveMemberUseCase(prisma);

    await useCase.execute({
      groupId: 'group-1',
      targetUserId: 'user-2',
      actorId: 'owner-1',
    });

    expect(mocks.memberDelete).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: 'group-1', userId: 'user-2' } },
    });
  });

  it('user leaves self successfully', async () => {
    const { prisma, mocks } = buildMocks();
    const useCase = new RemoveMemberUseCase(prisma);

    await useCase.execute({
      groupId: 'group-1',
      targetUserId: 'user-2',
      actorId: 'user-2',
    });

    expect(mocks.memberDelete).toHaveBeenCalled();
  });

  it('throws 409 OWNER_CANNOT_LEAVE when owner tries to leave', async () => {
    const { prisma } = buildMocks();
    const useCase = new RemoveMemberUseCase(prisma);

    await expect(
      useCase.execute({
        groupId: 'group-1',
        targetUserId: 'owner-1',
        actorId: 'owner-1',
      }),
    ).rejects.toThrow('OWNER_CANNOT_LEAVE');
  });

  it('throws 403 when non-owner tries to remove another', async () => {
    const { prisma } = buildMocks();
    const useCase = new RemoveMemberUseCase(prisma);

    await expect(
      useCase.execute({
        groupId: 'group-1',
        targetUserId: 'user-3',
        actorId: 'user-2',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws 404 when group not found', async () => {
    const { prisma, mocks } = buildMocks();
    mocks.groupFindUnique.mockResolvedValue(null);
    const useCase = new RemoveMemberUseCase(prisma);

    await expect(
      useCase.execute({
        groupId: 'group-99',
        targetUserId: 'user-2',
        actorId: 'owner-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
