import { MatchNotificationService } from './match-notification.service';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { NotificationProvider } from '../../../push/notification-provider.interface';
import type { PushService } from '../../../push/application/push.service';

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    client: {
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue(null), // no existing delivery by default
        create: jest.fn().mockResolvedValue({ id: 'delivery-1' }),
      },
      ...prismaOverrides,
    },
  } as unknown as PrismaService;

  const provider: jest.Mocked<NotificationProvider> = {
    sendToUser: jest.fn().mockResolvedValue(undefined),
  };

  const pushService: jest.Mocked<Pick<PushService, 'sendNotification'>> = {
    sendNotification: jest.fn().mockResolvedValue(undefined),
  };

  const service = new MatchNotificationService(
    prisma,
    provider,
    pushService as unknown as PushService,
  );
  return { service, prisma, provider, pushService };
}

// ── onInvited ──────────────────────────────────────────────────────────────

describe('MatchNotificationService.onInvited', () => {
  it('sends notification and records delivery when no prior delivery', async () => {
    const { service, prisma, provider } = buildService();

    await service.onInvited({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      invitedUserId: 'user-1',
    });

    expect(provider.sendToUser).toHaveBeenCalledWith('user-1', {
      title: 'Te invitaron a un partido',
      body: 'Fuiste invitado a "Fútbol 5".',
      data: { type: 'invited', matchId: 'match-1' },
    });

    expect(
      (prisma.client as any).notificationDelivery.create,
    ).toHaveBeenCalledWith({
      data: { userId: 'user-1', matchId: 'match-1', type: 'invited' },
    });
  });

  it('skips notification when delivery exists within cooldown window', async () => {
    const { service, provider } = buildService({
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }), // cooldown active
        create: jest.fn(),
      },
    });

    await service.onInvited({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      invitedUserId: 'user-1',
    });

    expect(provider.sendToUser).not.toHaveBeenCalled();
  });
});

// ── onPromoted ─────────────────────────────────────────────────────────────

describe('MatchNotificationService.onPromoted', () => {
  it('delegates to pushService.sendNotification with revision-based dedupeKey', async () => {
    const { service, pushService } = buildService();

    await service.onPromoted({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      promotedUserId: 'user-2',
      revision: 7,
    });

    expect(pushService.sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user-2',
      type: 'promoted',
      dedupeKey: 'waitlist-promoted:match-1:user-2:7',
      matchId: 'match-1',
      payload: {
        title: '¡Tenés lugar confirmado!',
        body: 'Saliste de la lista de espera en "Fútbol 5".',
        data: { type: 'promoted', matchId: 'match-1' },
      },
    });
  });

  it('does not call provider.sendToUser (migrated to PushService)', async () => {
    const { service, provider } = buildService();
    await service.onPromoted({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      promotedUserId: 'user-2',
      revision: 7,
    });
    expect(provider.sendToUser).not.toHaveBeenCalled();
  });
});

// ── onCanceled ─────────────────────────────────────────────────────────────

describe('MatchNotificationService.onCanceled', () => {
  it('notifies all users except the actor', async () => {
    const { service, provider } = buildService();

    await service.onCanceled({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1', 'user-2', 'admin-1'],
      actorId: 'admin-1',
    });

    expect(provider.sendToUser).toHaveBeenCalledTimes(2);
    expect(provider.sendToUser).toHaveBeenCalledWith('user-1', {
      title: 'Partido cancelado',
      body: '"Fútbol 5" fue cancelado por el organizador.',
      data: { type: 'canceled', matchId: 'match-1' },
    });
    expect(provider.sendToUser).toHaveBeenCalledWith('user-2', {
      title: 'Partido cancelado',
      body: '"Fútbol 5" fue cancelado por el organizador.',
      data: { type: 'canceled', matchId: 'match-1' },
    });
    // Actor should NOT be notified
    expect(provider.sendToUser).not.toHaveBeenCalledWith(
      'admin-1',
      expect.anything(),
    );
  });

  it('skips users whose delivery is within cooldown window', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null) // user-1: send
      .mockResolvedValueOnce({ id: 'existing' }); // user-2: skip (cooldown)

    const { service, provider } = buildService({
      notificationDelivery: {
        findFirst,
        create: jest.fn().mockResolvedValue({ id: 'delivery-1' }),
      },
    });

    await service.onCanceled({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1', 'user-2'],
      actorId: 'other',
    });

    expect(provider.sendToUser).toHaveBeenCalledTimes(1);
    expect(provider.sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
    );
  });

  it('does nothing when userIds is empty', async () => {
    const { service, provider } = buildService();

    await service.onCanceled({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: [],
      actorId: 'admin-1',
    });

    expect(provider.sendToUser).not.toHaveBeenCalled();
  });
});

// ── onCanceled (system cancel, actorId=null) ────────────────────────────────

describe('MatchNotificationService.onCanceled — system cancel', () => {
  it('notifies all users when actorId is null (system cancel)', async () => {
    const { service, provider } = buildService();

    await service.onCanceled({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1', 'user-2'],
      actorId: null,
    });

    expect(provider.sendToUser).toHaveBeenCalledTimes(2);
    expect(provider.sendToUser).toHaveBeenCalledWith('user-1', {
      title: 'Partido cancelado',
      body: '"Fútbol 5" fue cancelado automáticamente por falta de jugadores.',
      data: { type: 'canceled', matchId: 'match-1' },
    });
    expect(provider.sendToUser).toHaveBeenCalledWith('user-2', {
      title: 'Partido cancelado',
      body: '"Fútbol 5" fue cancelado automáticamente por falta de jugadores.',
      data: { type: 'canceled', matchId: 'match-1' },
    });
  });
});

// ── onReminderMissingPlayers ────────────────────────────────────────────────

describe('MatchNotificationService.onReminderMissingPlayers', () => {
  it('delegates to pushService.sendNotification with bucket-based dedupeKey', async () => {
    const { service, pushService } = buildService();

    await service.onReminderMissingPlayers({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1', 'user-2'],
      missingCount: 3,
      minutesToStart: 45,
      bucket: 'b3',
    });

    expect(pushService.sendNotification).toHaveBeenCalledTimes(2);
    expect(pushService.sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user-1',
      type: 'reminder_missing_players',
      dedupeKey: 'match-reminder:match-1:user-1:b3',
      matchId: 'match-1',
      payload: {
        title: 'Faltan jugadores',
        body: 'Faltan 3 jugadores para "Fútbol 5" (45 min).',
        data: { type: 'reminder_missing_players', matchId: 'match-1' },
      },
    });
  });

  it('does not call provider.sendToUser (migrated to PushService)', async () => {
    const { service, provider } = buildService();

    await service.onReminderMissingPlayers({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1'],
      missingCount: 3,
      minutesToStart: 45,
      bucket: 'b3',
    });

    expect(provider.sendToUser).not.toHaveBeenCalled();
  });
});

// ── onMissingPlayersAlert ───────────────────────────────────────────────────

describe('MatchNotificationService.onMissingPlayersAlert', () => {
  it('sends alert with correct body', async () => {
    const { service, provider } = buildService();

    await service.onMissingPlayersAlert({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1', 'user-2'],
      missingCount: 2,
      minutesToStart: 30,
    });

    expect(provider.sendToUser).toHaveBeenCalledTimes(2);
    expect(provider.sendToUser).toHaveBeenCalledWith('user-1', {
      title: 'Se bajó un jugador',
      body: 'Faltan 2 jugadores para "Fútbol 5" (30 min).',
      data: { type: 'missing_players_alert', matchId: 'match-1' },
    });
  });

  it('skips when within 5-min cooldown', async () => {
    const { service, provider } = buildService({
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
        create: jest.fn(),
      },
    });

    await service.onMissingPlayersAlert({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1'],
      missingCount: 2,
      minutesToStart: 30,
    });

    expect(provider.sendToUser).not.toHaveBeenCalled();
  });
});

// ── onReconfirmRequired ────────────────────────────────────────────────────

describe('MatchNotificationService.onReconfirmRequired', () => {
  it('delegates to pushService.sendNotification for each user with revision-based dedupeKey', async () => {
    const { service, pushService } = buildService();

    await service.onReconfirmRequired({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1', 'user-2'],
      revision: 12,
    });

    expect(pushService.sendNotification).toHaveBeenCalledTimes(2);
    expect(pushService.sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user-1',
      type: 'reconfirm_required',
      dedupeKey: 'major-change:match-1:user-1:12',
      matchId: 'match-1',
      payload: {
        title: 'Reconfirmación requerida',
        body: 'Hubo cambios importantes en "Fútbol 5". Por favor reconfirmá tu participación.',
        data: { type: 'reconfirm_required', matchId: 'match-1' },
      },
    });
    expect(pushService.sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user-2',
      type: 'reconfirm_required',
      dedupeKey: 'major-change:match-1:user-2:12',
      matchId: 'match-1',
      payload: expect.objectContaining({ title: 'Reconfirmación requerida' }),
    });
  });

  it('does not call provider.sendToUser (migrated to PushService)', async () => {
    const { service, provider } = buildService();
    await service.onReconfirmRequired({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1'],
      revision: 12,
    });
    expect(provider.sendToUser).not.toHaveBeenCalled();
  });
});
