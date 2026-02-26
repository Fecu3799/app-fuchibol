import { Injectable, Logger } from '@nestjs/common';

export abstract class EmailService {
  abstract sendEmailVerification(to: string, token: string): Promise<void>;
}

/** Dev implementation: logs to console instead of sending real emails */
@Injectable()
export class DevEmailService extends EmailService {
  private readonly logger = new Logger('DevEmailService');

  sendEmailVerification(to: string, token: string): Promise<void> {
    this.logger.log(`[EMAIL VERIFY] to=${to} token=${token}`);
    return Promise.resolve();
  }
}
