import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

@Injectable()
export class ConfirmGroupAvatarUseCase {
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    this.maxBytes = this.config.get<number>('AVATAR_MAX_BYTES', 3_145_728);
  }

  async execute(
    groupId: string,
    actorId: string,
    input: { key: string; contentType: string; size: number },
  ): Promise<{ avatarUrl: string }> {
    const group = await this.prisma.client.group.findUnique({
      where: { id: groupId },
      select: { ownerId: true },
    });
    if (!group) throw new NotFoundException('GROUP_NOT_FOUND');
    if (group.ownerId !== actorId) throw new ForbiddenException('NOT_OWNER');

    if (!input.key.startsWith(`avatars/groups/${groupId}/`)) {
      throw new UnprocessableEntityException('invalid_avatar_key');
    }
    if (!ALLOWED_TYPES.includes(input.contentType)) {
      throw new UnprocessableEntityException('invalid_content_type');
    }
    if (input.size <= 0 || input.size > this.maxBytes) {
      throw new UnprocessableEntityException('file_too_large');
    }

    const avatarUrl = this.storage.buildPublicUrl(input.key);
    await this.prisma.client.group.update({
      where: { id: groupId },
      data: { avatarUrl },
    });

    return { avatarUrl };
  }
}
