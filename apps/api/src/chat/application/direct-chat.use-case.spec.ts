import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DirectChatAccessService } from './direct-chat-access.service';
import { GetOrCreateDirectConversationUseCase } from './get-or-create-direct-conversation.use-case';
import { ListDirectConversationsUseCase } from './list-direct-conversations.use-case';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { StorageService } from '../../infra/storage/storage.service';

// ── helpers ──

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return {
    client: {
      conversation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      ...overrides,
    },
  } as unknown as PrismaService;
}

function makeStorage(): StorageService {
  return {
    buildPublicUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
  } as unknown as StorageService;
}

const NOW = new Date('2026-01-01T10:00:00.000Z');
const LATER = new Date('2026-01-01T11:00:00.000Z');

// IDs ordered lexicographically: USER_A < USER_B
const USER_A = 'aaa00000-0000-0000-0000-000000000001';
const USER_B = 'bbb00000-0000-0000-0000-000000000002';
const USER_C = 'ccc00000-0000-0000-0000-000000000003';
const CONV_ID = 'conv0000-0000-0000-0000-000000000001';

// ── DirectChatAccessService ──

describe('DirectChatAccessService', () => {
  it('returns true when user is userA', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue({
      userAId: USER_A,
      userBId: USER_B,
    });
    const svc = new DirectChatAccessService(prisma);
    expect(await svc.checkAccess(CONV_ID, USER_A)).toBe(true);
  });

  it('returns true when user is userB', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue({
      userAId: USER_A,
      userBId: USER_B,
    });
    const svc = new DirectChatAccessService(prisma);
    expect(await svc.checkAccess(CONV_ID, USER_B)).toBe(true);
  });

  it('returns false for a third user', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue({
      userAId: USER_A,
      userBId: USER_B,
    });
    const svc = new DirectChatAccessService(prisma);
    expect(await svc.checkAccess(CONV_ID, USER_C)).toBe(false);
  });

  it('returns false when conversation does not exist', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    const svc = new DirectChatAccessService(prisma);
    expect(await svc.checkAccess(CONV_ID, USER_A)).toBe(false);
  });
});

// ── GetOrCreateDirectConversationUseCase ──

describe('GetOrCreateDirectConversationUseCase', () => {
  it('throws CANNOT_CHAT_WITH_SELF when requester targets themselves', async () => {
    const prisma = makePrisma();
    const uc = new GetOrCreateDirectConversationUseCase(prisma);
    await expect(uc.execute(USER_A, USER_A)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws USER_NOT_FOUND when target does not exist', async () => {
    const prisma = makePrisma();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);
    const uc = new GetOrCreateDirectConversationUseCase(prisma);
    await expect(uc.execute(USER_A, USER_B)).rejects.toThrow(NotFoundException);
  });

  it('returns existing conversation when one already exists', async () => {
    const prisma = makePrisma();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({
      id: USER_B,
    });
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue({
      id: CONV_ID,
      type: 'DIRECT',
    });
    const uc = new GetOrCreateDirectConversationUseCase(prisma);
    const result = await uc.execute(USER_A, USER_B);
    expect(result).toEqual({ id: CONV_ID, type: 'DIRECT', isReadOnly: false });
    expect(prisma.client.conversation.create).not.toHaveBeenCalled();
  });

  it('creates conversation when none exists', async () => {
    const prisma = makePrisma();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({
      id: USER_B,
    });
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.client.conversation.create as jest.Mock).mockResolvedValue({
      id: CONV_ID,
      type: 'DIRECT',
    });
    const uc = new GetOrCreateDirectConversationUseCase(prisma);
    const result = await uc.execute(USER_A, USER_B);
    expect(result).toEqual({ id: CONV_ID, type: 'DIRECT', isReadOnly: false });
    expect(prisma.client.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'DIRECT',
          userAId: USER_A,
          userBId: USER_B,
        }),
      }),
    );
  });

  it('stores userA as lexicographically smaller regardless of who initiates', async () => {
    const prisma = makePrisma();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({
      id: USER_A,
    });
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.client.conversation.create as jest.Mock).mockResolvedValue({
      id: CONV_ID,
      type: 'DIRECT',
    });
    const uc = new GetOrCreateDirectConversationUseCase(prisma);
    // USER_B initiates, targeting USER_A — canonical order must still be A < B
    await uc.execute(USER_B, USER_A);
    const createCall = (prisma.client.conversation.create as jest.Mock).mock
      .calls[0][0];
    expect(createCall.data.userAId).toBe(USER_A);
    expect(createCall.data.userBId).toBe(USER_B);
  });

  it('handles race condition by re-fetching on P2002 unique violation', async () => {
    const prisma = makePrisma();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({
      id: USER_B,
    });
    (prisma.client.conversation.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // first find: no existing
      .mockResolvedValueOnce({ id: CONV_ID, type: 'DIRECT' }); // re-fetch after race
    (prisma.client.conversation.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
    });
    const uc = new GetOrCreateDirectConversationUseCase(prisma);
    const result = await uc.execute(USER_A, USER_B);
    expect(result.id).toBe(CONV_ID);
  });
});

// ── ListDirectConversationsUseCase ──

describe('ListDirectConversationsUseCase', () => {
  function makeConv(overrides: Record<string, unknown> = {}) {
    return {
      id: CONV_ID,
      type: 'DIRECT',
      userAId: USER_A,
      userBId: USER_B,
      updatedAt: NOW,
      userA: { id: USER_A, username: 'alice', avatar: null },
      userB: { id: USER_B, username: 'bob', avatar: null },
      messages: [],
      ...overrides,
    };
  }

  it('returns empty array when user has no direct conversations', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([]);
    const uc = new ListDirectConversationsUseCase(prisma, makeStorage());
    expect(await uc.execute(USER_A)).toEqual([]);
  });

  it('returns correct shape with otherUser when user is userA', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv(),
    ]);
    const uc = new ListDirectConversationsUseCase(prisma, makeStorage());
    const [item] = await uc.execute(USER_A);
    expect(item).toMatchObject({
      id: CONV_ID,
      type: 'DIRECT',
      otherUser: { id: USER_B, username: 'bob', avatarUrl: null },
      lastMessage: null,
      updatedAt: NOW.toISOString(),
    });
  });

  it('returns correct otherUser when user is userB', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv(),
    ]);
    const uc = new ListDirectConversationsUseCase(prisma, makeStorage());
    const [item] = await uc.execute(USER_B);
    expect(item.otherUser).toMatchObject({ id: USER_A, username: 'alice' });
  });

  it('includes lastMessage when present', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv({
        messages: [
          {
            id: 'msg-1',
            body: '¿Jugamos?',
            sender: { username: 'alice' },
            createdAt: LATER,
          },
        ],
      }),
    ]);
    const uc = new ListDirectConversationsUseCase(prisma, makeStorage());
    const [item] = await uc.execute(USER_B);
    expect(item.lastMessage).toEqual({
      id: 'msg-1',
      body: '¿Jugamos?',
      senderUsername: 'alice',
      createdAt: LATER.toISOString(),
    });
  });

  it('sorts by last message time descending', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv({
        id: 'conv-old',
        messages: [
          { id: 'm1', body: 'old', sender: { username: 'a' }, createdAt: NOW },
        ],
      }),
      makeConv({
        id: 'conv-new',
        userBId: USER_C,
        userB: { id: USER_C, username: 'carol', avatar: null },
        messages: [
          {
            id: 'm2',
            body: 'new',
            sender: { username: 'b' },
            createdAt: LATER,
          },
        ],
      }),
    ]);
    const uc = new ListDirectConversationsUseCase(prisma, makeStorage());
    const result = await uc.execute(USER_A);
    expect(result[0].id).toBe('conv-new');
    expect(result[1].id).toBe('conv-old');
  });

  it('passes correct membership filter to prisma', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([]);
    const uc = new ListDirectConversationsUseCase(prisma, makeStorage());
    await uc.execute(USER_A);
    const [callArgs] = (prisma.client.conversation.findMany as jest.Mock).mock
      .calls;
    expect(callArgs[0].where).toMatchObject({
      type: 'DIRECT',
      OR: expect.arrayContaining([{ userAId: USER_A }, { userBId: USER_A }]),
    });
  });
});
