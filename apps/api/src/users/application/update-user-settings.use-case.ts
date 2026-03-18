import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { UserSettingsDto } from './get-user-settings.query';

export interface UpdateUserSettingsInput {
  userId: string;
  pushMatchReminders?: boolean;
  pushMatchChanges?: boolean;
  pushChatMessages?: boolean;
}

@Injectable()
export class UpdateUserSettingsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateUserSettingsInput): Promise<UserSettingsDto> {
    const { userId, ...patch } = input;

    const settings = await this.prisma.client.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        pushMatchReminders: patch.pushMatchReminders ?? true,
        pushMatchChanges: patch.pushMatchChanges ?? true,
        pushChatMessages: patch.pushChatMessages ?? true,
      },
      update: patch,
      select: {
        pushMatchReminders: true,
        pushMatchChanges: true,
        pushChatMessages: true,
      },
    });

    return settings;
  }
}
