import { CreateGroupUseCase } from './create-group.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

function buildMockPrisma() {
  const createdGroup = {
    id: 'group-1',
    name: 'My Group',
    ownerId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const tx = {
    group: {
      create: jest.fn().mockResolvedValue(createdGroup),
    },
    groupMember: {
      create: jest
        .fn()
        .mockResolvedValue({ groupId: 'group-1', userId: 'user-1' }),
    },
  };

  const prisma = {
    client: {
      $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    },
  } as unknown as PrismaService;

  return { prisma, tx };
}

describe('CreateGroupUseCase', () => {
  it('creates group and auto-adds owner as member', async () => {
    const { prisma, tx } = buildMockPrisma();
    const useCase = new CreateGroupUseCase(prisma);

    const result = await useCase.execute({
      name: 'My Group',
      actorId: 'user-1',
    });

    expect(result.id).toBe('group-1');
    expect(result.name).toBe('My Group');
    expect(result.ownerId).toBe('user-1');

    expect(tx.group.create).toHaveBeenCalledWith({
      data: { name: 'My Group', ownerId: 'user-1' },
    });

    expect(tx.groupMember.create).toHaveBeenCalledWith({
      data: { groupId: 'group-1', userId: 'user-1' },
    });
  });
});
