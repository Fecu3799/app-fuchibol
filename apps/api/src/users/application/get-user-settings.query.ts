import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface UserSettingsDto {
  pushMatchReminders: boolean;
  pushMatchChanges: boolean;
  pushChatMessages: boolean;
}

const DEFAULTS: UserSettingsDto = {
  pushMatchReminders: true,
  pushMatchChanges: true,
  pushChatMessages: true,
};

@Injectable()
export class GetUserSettingsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<UserSettingsDto> {
    const settings = await this.prisma.client.userSettings.findUnique({
      where: { userId },
      select: {
        pushMatchReminders: true,
        pushMatchChanges: true,
        pushChatMessages: true,
      },
    });

    if (!settings) return { ...DEFAULTS };

    return {
      pushMatchReminders: settings.pushMatchReminders,
      pushMatchChanges: settings.pushMatchChanges,
      pushChatMessages: settings.pushChatMessages,
    };
  }
}
