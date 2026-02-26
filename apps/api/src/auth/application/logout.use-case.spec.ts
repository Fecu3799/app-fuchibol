import { LogoutUseCase } from './logout.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

const buildPrisma = () =>
  ({
    client: {
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    },
  }) as unknown as PrismaService;

describe('LogoutUseCase', () => {
  it('revokes the current session by sessionId and userId', async () => {
    const prisma = buildPrisma();
    const useCase = new LogoutUseCase(prisma);

    await useCase.execute('session-uuid', 'user-uuid');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.client.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-uuid', userId: 'user-uuid', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
