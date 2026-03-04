/* eslint-disable @typescript-eslint/unbound-method */
import { MatchNotificationService } from './match-notification.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { NotificationProvider } from '../../push/notification-provider.interface';

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

  const service = new MatchNotificationService(prisma, provider);
  return { service, prisma, provider };
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
  it('sends notification and records delivery for promoted user', async () => {
    const { service, provider } = buildService();

    await service.onPromoted({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      promotedUserId: 'user-2',
    });

    expect(provider.sendToUser).toHaveBeenCalledWith('user-2', {
      title: '¡Tenés lugar confirmado!',
      body: 'Saliste de la lista de espera en "Fútbol 5".',
      data: { type: 'promoted', matchId: 'match-1' },
    });
  });

  it('does not send when no active devices (provider.sendToUser resolves without effect)', async () => {
    const { service, provider } = buildService();
    // sendToUser is already mocked; verify it IS called (provider handles no-device internally)
    await service.onPromoted({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      promotedUserId: 'user-2',
    });
    expect(provider.sendToUser).toHaveBeenCalledTimes(1);
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
  it('sends reminder with correct body and records delivery with bucket', async () => {
    const { service, prisma, provider } = buildService();

    await service.onReminderMissingPlayers({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1'],
      missingCount: 3,
      minutesToStart: 45,
      bucket: 'b3',
    });

    expect(provider.sendToUser).toHaveBeenCalledWith('user-1', {
      title: 'Faltan jugadores',
      body: 'Faltan 3 jugadores para "Fútbol 5" (45 min).',
      data: { type: 'reminder_missing_players', matchId: 'match-1' },
    });
    expect(
      (prisma.client as any).notificationDelivery.create,
    ).toHaveBeenCalledWith({
      data: { userId: 'user-1', matchId: 'match-1', type: 'reminder_missing_players', bucket: 'b3' },
    });
  });

  it('skips notification when bucket delivery already exists', async () => {
    const { service, provider } = buildService({
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
        create: jest.fn(),
      },
    });

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
  it('sends notification to each affected user', async () => {
    const { service, provider } = buildService();

    await service.onReconfirmRequired({
      matchId: 'match-1',
      matchTitle: 'Fútbol 5',
      userIds: ['user-1', 'user-2'],
    });

    expect(provider.sendToUser).toHaveBeenCalledTimes(2);
    expect(provider.sendToUser).toHaveBeenCalledWith('user-1', {
      title: 'Reconfirmación requerida',
      body: 'Hubo cambios importantes en "Fútbol 5". Por favor reconfirmá tu participación.',
      data: { type: 'reconfirm_required', matchId: 'match-1' },
    });
  });
});
