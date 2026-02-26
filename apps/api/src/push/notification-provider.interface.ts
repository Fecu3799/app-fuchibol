export interface NotificationPayload {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface NotificationProvider {
  sendToUser(userId: string, payload: NotificationPayload): Promise<void>;
}

export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');
