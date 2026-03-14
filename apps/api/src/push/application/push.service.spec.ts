import { PushService } from './push.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

function buildMockPrisma() {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const findMany = jest.fn().mockResolvedValue([]);
  const findFirst = jest.fn().mockResolvedValue(null);
  const create = jest
    .fn()
    .mockResolvedValue({ id: 'delivery-1', status: 'pending' });
  const update = jest.fn().mockResolvedValue({});

  const prisma = {
    client: {
      pushDevice: { updateMany, findMany },
      notificationDelivery: { findFirst, create, update },
    },
  } as unknown as PrismaService;
  return { prisma, updateMany, findMany, findFirst, create, update };
}

const validToken = 'ExponentPushToken[test-token-123]';

function mockFetch(status: number, body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  });
}

const baseNotificationInput = {
  recipientUserId: 'user-1',
  type: 'promoted',
  dedupeKey: 'waitlist-promoted:match-1:user-1:5',
  matchId: 'match-1',
  payload: {
    title: '¡Tenés lugar!',
    body: 'Saliste de la lista de espera.',
    data: { type: 'promoted', matchId: 'match-1' },
  },
};

describe('PushService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── sendExpoPush (existing tests) ─────────────────────────────────────────

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

  // ── sendNotification ────────────────────────────────────────────────────

  it('sendNotification: deduplicates when delivery already exists', async () => {
    const { prisma, findFirst, create } = buildMockPrisma();
    findFirst.mockResolvedValue({ id: 'existing-delivery' });
    global.fetch = jest.fn() as unknown as typeof fetch;

    const service = new PushService(prisma);
    await service.sendNotification(baseNotificationInput);

    expect(create).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sendNotification: suppresses when user has no devices', async () => {
    const { prisma, findMany, create, update } = buildMockPrisma();
    findMany.mockResolvedValue([]); // no devices
    global.fetch = jest.fn() as unknown as typeof fetch;

    const service = new PushService(prisma);
    await service.sendNotification(baseNotificationInput);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending' }),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'suppressed', reason: 'no_devices' },
      }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sendNotification: creates delivery and sends push when token exists', async () => {
    const { prisma, findMany, create, update } = buildMockPrisma();
    findMany.mockResolvedValue([{ expoPushToken: validToken }]);
    const fetchMock = mockFetch(200, {
      data: [{ status: 'ok', id: 'ticket-99' }],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new PushService(prisma);
    await service.sendNotification(baseNotificationInput);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'promoted',
          channel: 'push',
          dedupeKey: baseNotificationInput.dedupeKey,
          status: 'pending',
        }),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'sent', sentAt: expect.any(Date) },
      }),
    );
  });

  it('sendNotification: marks delivery failed when all tokens fail', async () => {
    const { prisma, findMany, update } = buildMockPrisma();
    findMany.mockResolvedValue([{ expoPushToken: validToken }]);
    global.fetch = mockFetch(500, {}) as unknown as typeof fetch;

    const service = new PushService(prisma);
    await service.sendNotification(baseNotificationInput);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('sendNotification: handles P2002 race condition gracefully', async () => {
    const { prisma, create } = buildMockPrisma();
    const p2002 = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
    });
    create.mockRejectedValue(p2002);
    global.fetch = jest.fn() as unknown as typeof fetch;

    const service = new PushService(prisma);
    // Should not throw
    await expect(
      service.sendNotification(baseNotificationInput),
    ).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
