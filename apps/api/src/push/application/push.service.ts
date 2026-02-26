import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

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

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

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
