import { UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfirmAvatarUseCase } from './confirm-avatar.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

const mockUpsert = jest.fn().mockResolvedValue({});
const mockPrisma = {
  client: {
    userAvatar: { upsert: mockUpsert },
  },
} as unknown as PrismaService;

const mockStorage = {
  buildPublicUrl: jest.fn((key: string) => `http://localhost:9000/bucket/${key}`),
};

const mockConfig = {
  get: jest.fn((key: string, def?: unknown) => {
    if (key === 'AVATAR_MAX_BYTES') return 3_145_728;
    return def;
  }),
};

describe('ConfirmAvatarUseCase', () => {
  let useCase: ConfirmAvatarUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ConfirmAvatarUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    useCase = module.get(ConfirmAvatarUseCase);
  });

  it('upserts UserAvatar and returns avatarUrl', async () => {
    const key = 'avatars/user-1/abc.jpg';
    const result = await useCase.execute('user-1', {
      key,
      contentType: 'image/jpeg',
      size: 1_000_000,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        create: expect.objectContaining({ userId: 'user-1', key }),
        update: expect.objectContaining({ key }),
      }),
    );
    expect(result.avatarUrl).toContain(key);
  });

  it('rejects key that does not belong to the user', async () => {
    await expect(
      useCase.execute('user-1', {
        key: 'avatars/other-user/abc.jpg',
        contentType: 'image/jpeg',
        size: 100,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects invalid content type', async () => {
    await expect(
      useCase.execute('user-1', {
        key: 'avatars/user-1/abc.jpg',
        contentType: 'image/gif',
        size: 100,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects file exceeding size limit', async () => {
    await expect(
      useCase.execute('user-1', {
        key: 'avatars/user-1/abc.jpg',
        contentType: 'image/jpeg',
        size: 3_145_729,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
