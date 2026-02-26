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
  | 'canceled';

const COOLDOWN_MS: Record<MatchNotificationType, number> = {
  invited: 30 * 60 * 1000,
  promoted: 5 * 60 * 1000,
  reconfirm_required: 60 * 60 * 1000,
  canceled: 60 * 60 * 1000,
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
  actorId: string;
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
    // Don't notify the actor who executed the cancel
    const targets = userIds.filter((id) => id !== actorId);

    await Promise.allSettled(
      targets.map(async (userId) => {
        if (!(await this.shouldSend(userId, matchId, 'canceled'))) return;

        await this.provider.sendToUser(userId, {
          title: 'Partido cancelado',
          body: `"${matchTitle}" fue cancelado por el organizador.`,
          data: { type: 'canceled', matchId },
        });

        await this.recordDelivery(userId, matchId, 'canceled');
      }),
    );
  }

  private async shouldSend(
    userId: string,
    matchId: string,
    type: MatchNotificationType,
  ): Promise<boolean> {
    const cooldownMs = COOLDOWN_MS[type];
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
  ): Promise<void> {
    await this.prisma.client.notificationDelivery.create({
      data: { userId, matchId, type },
    });
  }
}
