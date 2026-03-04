import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../../push/notification-provider.interface';

export type MatchNotificationType =
  | 'invited'
  | 'promoted'
  | 'reconfirm_required'
  | 'canceled'
  | 'reminder_missing_players'
  | 'missing_players_alert';

const COOLDOWN_MS: Partial<Record<MatchNotificationType, number>> = {
  invited: 30 * 60 * 1000,
  promoted: 5 * 60 * 1000,
  reconfirm_required: 60 * 60 * 1000,
  canceled: 60 * 60 * 1000,
  missing_players_alert: 5 * 60 * 1000,
  // reminder_missing_players uses bucket-based dedup (no time-window cooldown)
};

export interface OnInvitedInput {
  matchId: string;
  matchTitle: string;
  invitedUserId: string;
}

export interface OnPromotedInput {
  matchId: string;
  matchTitle: string;
  promotedUserId: string;
}

export interface OnReconfirmRequiredInput {
  matchId: string;
  matchTitle: string;
  userIds: string[];
}

export interface OnCanceledInput {
  matchId: string;
  matchTitle: string;
  userIds: string[];
  actorId: string | null;
}

export interface OnReminderMissingPlayersInput {
  matchId: string;
  matchTitle: string;
  userIds: string[];
  missingCount: number;
  minutesToStart: number;
  bucket: string;
}

export interface OnMissingPlayersAlertInput {
  matchId: string;
  matchTitle: string;
  userIds: string[];
  missingCount: number;
  minutesToStart: number;
}

@Injectable()
export class MatchNotificationService {
  private readonly logger = new Logger(MatchNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider,
  ) {}

  async onInvited(input: OnInvitedInput): Promise<void> {
    const { matchId, matchTitle, invitedUserId } = input;
    if (!(await this.shouldSend(invitedUserId, matchId, 'invited'))) return;

    await this.provider.sendToUser(invitedUserId, {
      title: 'Te invitaron a un partido',
      body: `Fuiste invitado a "${matchTitle}".`,
      data: { type: 'invited', matchId },
    });

    await this.recordDelivery(invitedUserId, matchId, 'invited');
  }

  async onPromoted(input: OnPromotedInput): Promise<void> {
    const { matchId, matchTitle, promotedUserId } = input;
    if (!(await this.shouldSend(promotedUserId, matchId, 'promoted'))) return;

    await this.provider.sendToUser(promotedUserId, {
      title: '¡Tenés lugar confirmado!',
      body: `Saliste de la lista de espera en "${matchTitle}".`,
      data: { type: 'promoted', matchId },
    });

    await this.recordDelivery(promotedUserId, matchId, 'promoted');
  }

  async onReconfirmRequired(input: OnReconfirmRequiredInput): Promise<void> {
    const { matchId, matchTitle, userIds } = input;

    await Promise.allSettled(
      userIds.map(async (userId) => {
        if (!(await this.shouldSend(userId, matchId, 'reconfirm_required')))
          return;

        await this.provider.sendToUser(userId, {
          title: 'Reconfirmación requerida',
          body: `Hubo cambios importantes en "${matchTitle}". Por favor reconfirmá tu participación.`,
          data: { type: 'reconfirm_required', matchId },
        });

        await this.recordDelivery(userId, matchId, 'reconfirm_required');
      }),
    );
  }

  async onCanceled(input: OnCanceledInput): Promise<void> {
    const { matchId, matchTitle, userIds, actorId } = input;
    // actorId == null means system cancel → notify all; otherwise skip the actor
    const targets =
      actorId !== null ? userIds.filter((id) => id !== actorId) : userIds;

    const body =
      actorId !== null
        ? `"${matchTitle}" fue cancelado por el organizador.`
        : `"${matchTitle}" fue cancelado automáticamente por falta de jugadores.`;

    await Promise.allSettled(
      targets.map(async (userId) => {
        if (!(await this.shouldSend(userId, matchId, 'canceled'))) return;

        await this.provider.sendToUser(userId, {
          title: 'Partido cancelado',
          body,
          data: { type: 'canceled', matchId },
        });

        await this.recordDelivery(userId, matchId, 'canceled');
      }),
    );
  }

  async onReminderMissingPlayers(
    input: OnReminderMissingPlayersInput,
  ): Promise<void> {
    const { matchId, matchTitle, userIds, missingCount, minutesToStart, bucket } =
      input;

    await Promise.allSettled(
      userIds.map(async (userId) => {
        if (
          !(await this.shouldSend(
            userId,
            matchId,
            'reminder_missing_players',
            bucket,
          ))
        )
          return;

        await this.provider.sendToUser(userId, {
          title: 'Faltan jugadores',
          body: `Faltan ${missingCount} jugadores para "${matchTitle}" (${Math.round(minutesToStart)} min).`,
          data: { type: 'reminder_missing_players', matchId },
        });

        await this.recordDelivery(
          userId,
          matchId,
          'reminder_missing_players',
          bucket,
        );
      }),
    );
  }

  async onMissingPlayersAlert(input: OnMissingPlayersAlertInput): Promise<void> {
    const { matchId, matchTitle, userIds, missingCount, minutesToStart } = input;

    await Promise.allSettled(
      userIds.map(async (userId) => {
        if (
          !(await this.shouldSend(userId, matchId, 'missing_players_alert'))
        )
          return;

        await this.provider.sendToUser(userId, {
          title: 'Se bajó un jugador',
          body: `Faltan ${missingCount} jugadores para "${matchTitle}" (${Math.round(minutesToStart)} min).`,
          data: { type: 'missing_players_alert', matchId },
        });

        await this.recordDelivery(userId, matchId, 'missing_players_alert');
      }),
    );
  }

  private async shouldSend(
    userId: string,
    matchId: string,
    type: MatchNotificationType,
    bucket?: string,
  ): Promise<boolean> {
    if (bucket !== undefined) {
      // Bucket-based dedup: one notification per (userId, matchId, type, bucket)
      const existing = await this.prisma.client.notificationDelivery.findFirst({
        where: { userId, matchId, type, bucket },
      });
      return existing === null;
    }

    const cooldownMs = COOLDOWN_MS[type];
    if (cooldownMs === undefined) return true;
    const since = new Date(Date.now() - cooldownMs);

    const existing = await this.prisma.client.notificationDelivery.findFirst({
      where: { userId, matchId, type, createdAt: { gte: since } },
    });

    return existing === null;
  }

  private async recordDelivery(
    userId: string,
    matchId: string,
    type: MatchNotificationType,
    bucket?: string,
  ): Promise<void> {
    await this.prisma.client.notificationDelivery.create({
      data: { userId, matchId, type, ...(bucket !== undefined ? { bucket } : {}) },
    });
  }
}
