import { Injectable } from '@nestjs/common';
import { PushService } from './application/push.service';
import type {
  NotificationPayload,
  NotificationProvider,
} from './notification-provider.interface';

@Injectable()
export class ExpoNotificationProvider implements NotificationProvider {
  constructor(private readonly pushService: PushService) {}

  async sendToUser(
    userId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const tokens = await this.pushService.getActiveTokensForUser(userId);
    if (!tokens.length) return;

    await Promise.allSettled(
      tokens.map((token) =>
        this.pushService.sendExpoPush({
          toToken: token,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        }),
      ),
    );
  }
}
