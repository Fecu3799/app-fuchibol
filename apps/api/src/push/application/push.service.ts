import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const PUSH_CHANNEL = 'push';

type UserPrefFlag =
  | 'pushMatchReminders'
  | 'pushMatchChanges'
  | 'pushChatMessages';

/**
 * Notification types that bypass user preference settings.
 * These are always delivered regardless of per-flag configuration.
 */
const CRITICAL_NOTIFICATION_TYPES = new Set(['canceled']);

/**
 * Maps a notification type to the user settings flag that controls it.
 * Returns null for unmapped types (always deliver).
 */
function getPreferenceFlag(type: string): UserPrefFlag | null {
  if (
    type === 'reminder_24h' ||
    type === 'reminder_2h' ||
    type === 'reminder_missing_players'
  ) {
    return 'pushMatchReminders';
  }
  if (
    type === 'promoted' ||
    type === 'reconfirm_required' ||
    type === 'invited' ||
    type === 'missing_players_alert' ||
    type === 'match_started' ||
    type === 'teams_auto_generated'
  ) {
    return 'pushMatchChanges';
  }
  if (type === 'chat_message') {
    return 'pushChatMessages';
  }
  return null;
}

interface SendExpoPushInput {
  toToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoPushResponse {
  data: Array<{
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string };
  }>;
}

export interface SendNotificationInput {
  recipientUserId: string;
  type: string;
  dedupeKey: string;
  matchId?: string;
  conversationId?: string;
  payload: { title: string; body: string; data: Record<string, unknown> };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Orchestrated push delivery with dedup, suppression, and delivery record.
   *
   * Flow:
   *  1. Check existing delivery by (channel, dedupeKey) → skip if found
   *  2. Create NotificationDelivery with status="pending"
   *  3. Get active tokens → suppress if none
   *  4. Send via Expo → update to "sent" or "failed"
   */
  async sendNotification(input: SendNotificationInput): Promise<void> {
    // 1. Dedup check
    const existing = await this.prisma.client.notificationDelivery.findFirst({
      where: { channel: PUSH_CHANNEL, dedupeKey: input.dedupeKey },
      select: { id: true },
    });

    if (existing) {
      this.logger.log({
        op: 'pushDeliveryDeduplicated',
        recipientUserId: input.recipientUserId,
        type: input.type,
        dedupeKey: input.dedupeKey,
        matchId: input.matchId,
      });
      return;
    }

    // 2. Create delivery record
    let deliveryId: string;
    try {
      const delivery = await this.prisma.client.notificationDelivery.create({
        data: {
          userId: input.recipientUserId,
          type: input.type,
          channel: PUSH_CHANNEL,
          dedupeKey: input.dedupeKey,
          status: 'pending',
          matchId: input.matchId ?? null,
          conversationId: input.conversationId ?? null,
          payload: input.payload as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      deliveryId = delivery.id;
    } catch (err: unknown) {
      // P2002 = unique constraint violation → race-condition dedup
      if ((err as { code?: string })?.code === 'P2002') {
        this.logger.log({
          op: 'pushDeliveryDeduplicated',
          recipientUserId: input.recipientUserId,
          type: input.type,
          dedupeKey: input.dedupeKey,
          reason: 'race_condition',
        });
        return;
      }
      throw err;
    }

    this.logger.log({
      op: 'pushDeliveryCreated',
      recipientUserId: input.recipientUserId,
      type: input.type,
      dedupeKey: input.dedupeKey,
      matchId: input.matchId,
    });

    // 3. Check user preferences (critical types bypass this check)
    if (!CRITICAL_NOTIFICATION_TYPES.has(input.type)) {
      const prefFlag = getPreferenceFlag(input.type);
      if (prefFlag !== null) {
        const settings = await this.prisma.client.userSettings.findUnique({
          where: { userId: input.recipientUserId },
          select: {
            pushMatchReminders: true,
            pushMatchChanges: true,
            pushChatMessages: true,
          },
        });
        // No record = default true; explicit false = suppress
        const isEnabled = settings ? settings[prefFlag] : true;
        if (!isEnabled) {
          await this.prisma.client.notificationDelivery.update({
            where: { id: deliveryId },
            data: { status: 'suppressed', reason: 'PREFERENCE_DISABLED' },
          });
          this.logger.log({
            op: 'pushSuppressedByPreference',
            recipientUserId: input.recipientUserId,
            type: input.type,
            dedupeKey: input.dedupeKey,
          });
          return;
        }
      }
    }

    // 5. Get active tokens
    const tokens = await this.getActiveTokensForUser(input.recipientUserId);

    if (!tokens.length) {
      await this.prisma.client.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: 'suppressed', reason: 'no_devices' },
      });
      this.logger.log({
        op: 'pushDeliverySuppressed',
        recipientUserId: input.recipientUserId,
        type: input.type,
        dedupeKey: input.dedupeKey,
        reason: 'no_devices',
      });
      return;
    }

    // 6. Send to all active devices
    try {
      const results = await Promise.allSettled(
        tokens.map((token) =>
          this.sendExpoPush({
            toToken: token,
            title: input.payload.title,
            body: input.payload.body,
            data: input.payload.data,
          }),
        ),
      );

      const anySuccess = results.some((r) => r.status === 'fulfilled');
      const firstRejection = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );

      if (anySuccess) {
        await this.prisma.client.notificationDelivery.update({
          where: { id: deliveryId },
          data: { status: 'sent', sentAt: new Date() },
        });
        this.logger.log({
          op: 'pushDeliverySent',
          recipientUserId: input.recipientUserId,
          type: input.type,
          dedupeKey: input.dedupeKey,
          matchId: input.matchId,
        });
      } else {
        const reason =
          (firstRejection?.reason as Error)?.message ?? 'all_tokens_failed';
        await this.prisma.client.notificationDelivery.update({
          where: { id: deliveryId },
          data: { status: 'failed', reason },
        });
        this.logger.warn({
          op: 'pushDeliveryFailed',
          recipientUserId: input.recipientUserId,
          type: input.type,
          dedupeKey: input.dedupeKey,
          reason,
        });
      }
    } catch (err: unknown) {
      const reason = (err as Error)?.message ?? 'unknown';
      await this.prisma.client.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: 'failed', reason },
      });
      this.logger.warn({
        op: 'pushDeliveryFailed',
        recipientUserId: input.recipientUserId,
        type: input.type,
        dedupeKey: input.dedupeKey,
        reason,
      });
    }
  }

  async sendExpoPush(input: SendExpoPushInput): Promise<void> {
    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: input.toToken,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
      }),
    });

    if (!res.ok) {
      throw new Error(`Expo push API HTTP error: ${res.status}`);
    }

    const json = (await res.json()) as ExpoPushResponse;
    const ticket = json.data?.[0];

    if (ticket?.status === 'error') {
      this.logger.warn(
        `Expo push error for token ${input.toToken}: ${ticket.message} (${ticket.details?.error})`,
      );
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await this.prisma.client.pushDevice.updateMany({
          where: { expoPushToken: input.toToken, disabledAt: null },
          data: { disabledAt: new Date() },
        });
      }
      throw new Error(`Push failed: ${ticket.message}`);
    }

    this.logger.debug(
      `Push sent OK to ${input.toToken}, ticketId=${ticket?.id}`,
    );
  }

  /** Returns all active push tokens for a user. */
  async getActiveTokensForUser(userId: string): Promise<string[]> {
    const devices = await this.prisma.client.pushDevice.findMany({
      where: { userId, disabledAt: null },
      select: { expoPushToken: true },
    });
    return devices.map((d) => d.expoPushToken);
  }
}
