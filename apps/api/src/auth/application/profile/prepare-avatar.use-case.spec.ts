import { UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrepareAvatarUseCase } from './prepare-avatar.use-case';
import { StorageService } from '../../../infra/storage/storage.service';

const mockStorage = {
  createPresignedPutUrl: jest
    .fn()
    .mockResolvedValue('https://s3.example.com/presigned'),
  buildPublicUrl: jest.fn(
    (key: string) => `http://localhost:9000/bucket/${key}`,
  ),
};

const mockConfig = {
  get: jest.fn((key: string, def?: unknown) => {
    if (key === 'AVATAR_MAX_BYTES') return 3_145_728;
    return def;
  }),
  getOrThrow: jest.fn(),
};

describe('PrepareAvatarUseCase', () => {
  let useCase: PrepareAvatarUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PrepareAvatarUseCase,
        { provide: StorageService, useValue: mockStorage },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    useCase = module.get(PrepareAvatarUseCase);
  });

  it('returns uploadUrl and key for valid jpeg', async () => {
    const result = await useCase.execute('user-1', {
      contentType: 'image/jpeg',
      size: 1_000_000,
    });

    expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
    expect(result.key).toMatch(/^avatars\/user-1\/.+\.jpg$/);
    expect(result.publicUrl).toContain(result.key);
    expect(mockStorage.createPresignedPutUrl).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/jpeg', expiresInSec: 300 }),
    );
  });

  it('returns uploadUrl and key for valid png', async () => {
    const result = await useCase.execute('user-1', {
      contentType: 'image/png',
      size: 500_000,
    });
    expect(result.key).toMatch(/\.png$/);
  });

  it('rejects invalid content type', async () => {
    await expect(
      useCase.execute('user-1', { contentType: 'image/gif', size: 100 }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects size exceeding limit', async () => {
    await expect(
      useCase.execute('user-1', {
        contentType: 'image/jpeg',
        size: 3_145_729,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects size <= 0', async () => {
    await expect(
      useCase.execute('user-1', { contentType: 'image/jpeg', size: 0 }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
