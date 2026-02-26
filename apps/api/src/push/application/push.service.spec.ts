import { PushService } from './push.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

function buildMockPrisma() {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    client: {
      pushDevice: { updateMany, findMany },
    },
  } as unknown as PrismaService;
  return { prisma, updateMany, findMany };
}

const validToken = 'ExponentPushToken[test-token-123]';

function mockFetch(status: number, body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  });
}

describe('PushService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends push to Expo API with correct payload', async () => {
    const { prisma } = buildMockPrisma();
    const fetchMock = mockFetch(200, {
      data: [{ status: 'ok', id: 'ticket-1' }],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new PushService(prisma);
    await service.sendExpoPush({
      toToken: validToken,
      title: 'Test',
      body: 'Hello',
      data: { matchId: 'match-1' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          to: validToken,
          title: 'Test',
          body: 'Hello',
          data: { matchId: 'match-1' },
        }),
      }),
    );
  });

  it('marks device disabled on DeviceNotRegistered Expo error', async () => {
    const { prisma, updateMany } = buildMockPrisma();
    const fetchMock = mockFetch(200, {
      data: [
        {
          status: 'error',
          message: 'not registered',
          details: { error: 'DeviceNotRegistered' },
        },
      ],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new PushService(prisma);
    await expect(
      service.sendExpoPush({ toToken: validToken, title: 'T', body: 'B' }),
    ).rejects.toThrow('Push failed');

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { expoPushToken: validToken, disabledAt: null },
        data: { disabledAt: expect.any(Date) },
      }),
    );
  });

  it('throws on Expo HTTP error', async () => {
    const { prisma } = buildMockPrisma();
    global.fetch = mockFetch(500, {}) as unknown as typeof fetch;

    const service = new PushService(prisma);
    await expect(
      service.sendExpoPush({ toToken: validToken, title: 'T', body: 'B' }),
    ).rejects.toThrow('Expo push API HTTP error: 500');
  });

  it('getActiveTokensForUser returns only active devices', async () => {
    const { prisma, findMany } = buildMockPrisma();
    findMany.mockResolvedValue([{ expoPushToken: validToken }]);

    const service = new PushService(prisma);
    const tokens = await service.getActiveTokensForUser('user-1');

    expect(tokens).toEqual([validToken]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', disabledAt: null },
      }),
    );
  });
});
