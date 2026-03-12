import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const PRESIGNED_TTL_SEC = 300;

@Injectable()
export class PrepareGroupAvatarUseCase {
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
    input: { contentType: string; size: number },
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    const group = await this.prisma.client.group.findUnique({
      where: { id: groupId },
      select: { ownerId: true },
    });
    if (!group) throw new NotFoundException('GROUP_NOT_FOUND');
    if (group.ownerId !== actorId) throw new ForbiddenException('NOT_OWNER');

    if (!ALLOWED_TYPES.includes(input.contentType)) {
      throw new UnprocessableEntityException('invalid_content_type');
    }
    if (input.size <= 0 || input.size > this.maxBytes) {
      throw new UnprocessableEntityException('file_too_large');
    }

    const ext = input.contentType === 'image/jpeg' ? 'jpg' : 'png';
    const key = `avatars/groups/${groupId}/${randomUUID()}.${ext}`;

    const uploadUrl = await this.storage.createPresignedPutUrl({
      key,
      contentType: input.contentType,
      expiresInSec: PRESIGNED_TTL_SEC,
    });

    return { uploadUrl, key, publicUrl: this.storage.buildPublicUrl(key) };
  }
}
