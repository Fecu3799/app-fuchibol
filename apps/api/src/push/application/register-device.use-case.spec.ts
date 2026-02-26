import { RegisterDeviceUseCase } from './register-device.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

function buildMockPrisma() {
  const upsert = jest.fn();
  const prisma = {
    client: {
      pushDevice: { upsert },
    },
  } as unknown as PrismaService;
  return { prisma, upsert };
}

describe('RegisterDeviceUseCase', () => {
  it('creates a new device on first register', async () => {
    const { prisma, upsert } = buildMockPrisma();
    const expected = {
      id: 'dev-1',
      expoPushToken: 'ExponentPushToken[abc]',
      platform: 'ios',
      disabledAt: null,
    };
    upsert.mockResolvedValue(expected);

    const useCase = new RegisterDeviceUseCase(prisma);
    const result = await useCase.execute({
      userId: 'user-1',
      expoPushToken: 'ExponentPushToken[abc]',
      platform: 'ios',
    });

    expect(result).toEqual(expected);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { expoPushToken: 'ExponentPushToken[abc]' },
        create: expect.objectContaining({
          userId: 'user-1',
          expoPushToken: 'ExponentPushToken[abc]',
          platform: 'ios',
        }),
        update: expect.objectContaining({
          userId: 'user-1',
          platform: 'ios',
          disabledAt: null,
        }),
      }),
    );
  });

  it('updates lastSeenAt and clears disabledAt on re-register', async () => {
    const { prisma, upsert } = buildMockPrisma();
    const updated = {
      id: 'dev-1',
      expoPushToken: 'ExponentPushToken[abc]',
      platform: 'ios',
      disabledAt: null,
    };
    upsert.mockResolvedValueOnce({
      ...updated,
      disabledAt: new Date('2026-01-01'),
    });
    upsert.mockResolvedValueOnce(updated);

    const useCase = new RegisterDeviceUseCase(prisma);
    await useCase.execute({
      userId: 'user-1',
      expoPushToken: 'ExponentPushToken[abc]',
      platform: 'ios',
    });
    const result = await useCase.execute({
      userId: 'user-1',
      expoPushToken: 'ExponentPushToken[abc]',
      platform: 'ios',
    });

    expect(upsert).toHaveBeenCalledTimes(2);
    // Second call must include disabledAt: null to re-enable device
    const secondCall = upsert.mock.calls[1][0];
    expect(secondCall.update.disabledAt).toBeNull();
    expect(result.disabledAt).toBeNull();
  });

  it('stores deviceName when provided', async () => {
    const { prisma, upsert } = buildMockPrisma();
    upsert.mockResolvedValue({
      id: 'dev-2',
      expoPushToken: 'ExpoPushToken[xyz]',
      platform: 'android',
      disabledAt: null,
    });

    const useCase = new RegisterDeviceUseCase(prisma);
    await useCase.execute({
      userId: 'user-2',
      expoPushToken: 'ExpoPushToken[xyz]',
      platform: 'android',
      deviceName: 'My Phone',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ deviceName: 'My Phone' }),
        update: expect.objectContaining({ deviceName: 'My Phone' }),
      }),
    );
  });
});
