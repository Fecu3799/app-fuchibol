import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

@Injectable()
export class ConfirmAvatarUseCase {
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    this.maxBytes = this.config.get<number>('AVATAR_MAX_BYTES', 3_145_728);
  }

  async execute(
    userId: string,
    input: { key: string; contentType: string; size: number },
  ): Promise<{ avatarUrl: string }> {
    if (!input.key.startsWith(`avatars/${userId}/`)) {
      throw new UnprocessableEntityException('invalid_avatar_key');
    }
    if (!ALLOWED_TYPES.includes(input.contentType)) {
      throw new UnprocessableEntityException('invalid_content_type');
    }
    if (input.size <= 0 || input.size > this.maxBytes) {
      throw new UnprocessableEntityException('file_too_large');
    }

    await this.prisma.client.userAvatar.upsert({
      where: { userId },
      create: {
        userId,
        key: input.key,
        contentType: input.contentType,
        size: input.size,
      },
      update: {
        key: input.key,
        contentType: input.contentType,
        size: input.size,
      },
    });

    return { avatarUrl: this.storage.buildPublicUrl(input.key) };
  }
}
