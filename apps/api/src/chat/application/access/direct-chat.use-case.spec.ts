import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DirectChatAccessService } from './direct-chat-access.service';
import { GetOrCreateDirectConversationUseCase } from '../conversations/get-or-create-direct-conversation.use-case';
import { FindDirectConversationUseCase } from '../conversations/find-direct-conversation.use-case';
import { SendFirstDirectMessageUseCase } from '../conversations/send-first-direct-message.use-case';
import { ListDirectConversationsUseCase } from '../conversations/list-direct-conversations.use-case';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { StorageService } from '../../../infra/storage/storage.service';

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
      conversationReadState: { findMany: jest.fn().mockResolvedValue([]) },
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

// ── FindDirectConversationUseCase ──

describe('FindDirectConversationUseCase', () => {
  it('throws CANNOT_CHAT_WITH_SELF', async () => {
    const prisma = makePrisma();
    const uc = new FindDirectConversationUseCase(prisma);
    await expect(uc.execute(USER_A, USER_A)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('returns null when no conversation exists', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    const uc = new FindDirectConversationUseCase(prisma);
    expect(await uc.execute(USER_A, USER_B)).toBeNull();
  });

  it('returns { id } when conversation exists', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue({
      id: CONV_ID,
    });
    const uc = new FindDirectConversationUseCase(prisma);
    expect(await uc.execute(USER_A, USER_B)).toEqual({ id: CONV_ID });
  });

  it('does not create conversation', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    const uc = new FindDirectConversationUseCase(prisma);
    await uc.execute(USER_A, USER_B);
    expect(prisma.client.conversation.create).not.toHaveBeenCalled();
  });

  it('uses canonical ordering regardless of who calls', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    const uc = new FindDirectConversationUseCase(prisma);
    await uc.execute(USER_B, USER_A); // B initiates, looking for A
    const [[callArgs]] = (prisma.client.conversation.findUnique as jest.Mock)
      .mock.calls;
    expect(callArgs.where.userAId_userBId).toEqual({
      userAId: USER_A,
      userBId: USER_B,
    });
  });
});

// ── SendFirstDirectMessageUseCase ──

function makePrismaForFirstMsg(
  overrides: Record<string, unknown> = {},
): PrismaService {
  return {
    client: {
      conversation: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      message: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      ...overrides,
    },
  } as unknown as PrismaService;
}

const MSG_ID = 'msg00000-0000-0000-0000-000000000001';

function makeMessageRow(convId = CONV_ID) {
  return {
    id: MSG_ID,
    conversationId: convId,
    senderId: USER_A,
    body: 'Hola!',
    clientMsgId: 'client-uuid-1',
    createdAt: NOW,
    sender: { username: 'alice', avatar: null },
  };
}

describe('SendFirstDirectMessageUseCase', () => {
  it('throws CANNOT_CHAT_WITH_SELF', async () => {
    const prisma = makePrismaForFirstMsg();
    const uc = new SendFirstDirectMessageUseCase(prisma, makeStorage());
    await expect(
      uc.execute({
        senderId: USER_A,
        targetUserId: USER_A,
        body: 'hi',
        clientMsgId: 'c1',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws USER_NOT_FOUND when target does not exist', async () => {
    const prisma = makePrismaForFirstMsg();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);
    const uc = new SendFirstDirectMessageUseCase(prisma, makeStorage());
    await expect(
      uc.execute({
        senderId: USER_A,
        targetUserId: USER_B,
        body: 'hi',
        clientMsgId: 'c1',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates conversation and message when neither exists', async () => {
    const prisma = makePrismaForFirstMsg();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({
      id: USER_B,
    });
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.client.conversation.create as jest.Mock).mockResolvedValue({
      id: CONV_ID,
    });
    (prisma.client.message.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.client.message.create as jest.Mock).mockResolvedValue(
      makeMessageRow(),
    );

    const uc = new SendFirstDirectMessageUseCase(prisma, makeStorage());
    const result = await uc.execute({
      senderId: USER_A,
      targetUserId: USER_B,
      body: 'Hola!',
      clientMsgId: 'client-uuid-1',
    });

    expect(result.conversationId).toBe(CONV_ID);
    expect(result.message.id).toBe(MSG_ID);
    expect(result.created).toBe(true);
    expect(prisma.client.conversation.create).toHaveBeenCalled();
    expect(prisma.client.message.create).toHaveBeenCalled();
  });

  it('reuses existing conversation when already created', async () => {
    const prisma = makePrismaForFirstMsg();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({
      id: USER_B,
    });
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue({
      id: CONV_ID,
    });
    (prisma.client.message.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.client.message.create as jest.Mock).mockResolvedValue(
      makeMessageRow(),
    );

    const uc = new SendFirstDirectMessageUseCase(prisma, makeStorage());
    const result = await uc.execute({
      senderId: USER_A,
      targetUserId: USER_B,
      body: 'Hola!',
      clientMsgId: 'client-uuid-1',
    });

    expect(result.conversationId).toBe(CONV_ID);
    expect(prisma.client.conversation.create).not.toHaveBeenCalled();
    expect(result.created).toBe(true);
  });

  it('returns idempotent result when clientMsgId already seen', async () => {
    const prisma = makePrismaForFirstMsg();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({
      id: USER_B,
    });
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue({
      id: CONV_ID,
    });
    (prisma.client.message.findUnique as jest.Mock).mockResolvedValue(
      makeMessageRow(),
    );

    const uc = new SendFirstDirectMessageUseCase(prisma, makeStorage());
    const result = await uc.execute({
      senderId: USER_A,
      targetUserId: USER_B,
      body: 'Hola!',
      clientMsgId: 'client-uuid-1',
    });

    expect(result.created).toBe(false);
    expect(result.message.id).toBe(MSG_ID);
    expect(prisma.client.message.create).not.toHaveBeenCalled();
  });

  it('handles race condition on conversation creation (P2002)', async () => {
    const prisma = makePrismaForFirstMsg();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({
      id: USER_B,
    });
    (prisma.client.conversation.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // first find: no existing
      .mockResolvedValueOnce({ id: CONV_ID }); // re-fetch after race
    (prisma.client.conversation.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
    });
    (prisma.client.message.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.client.message.create as jest.Mock).mockResolvedValue(
      makeMessageRow(),
    );

    const uc = new SendFirstDirectMessageUseCase(prisma, makeStorage());
    const result = await uc.execute({
      senderId: USER_A,
      targetUserId: USER_B,
      body: 'Hola!',
      clientMsgId: 'client-uuid-1',
    });

    expect(result.conversationId).toBe(CONV_ID);
    expect(result.created).toBe(true);
  });

  it('stores userA as lexicographically smaller regardless of sender', async () => {
    const prisma = makePrismaForFirstMsg();
    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({
      id: USER_A,
    });
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.client.conversation.create as jest.Mock).mockResolvedValue({
      id: CONV_ID,
    });
    (prisma.client.message.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.client.message.create as jest.Mock).mockResolvedValue(
      makeMessageRow(CONV_ID),
    );

    const uc = new SendFirstDirectMessageUseCase(prisma, makeStorage());
    // USER_B initiates, targeting USER_A
    await uc.execute({
      senderId: USER_B,
      targetUserId: USER_A,
      body: 'hi',
      clientMsgId: 'c1',
    });

    const createCall = (prisma.client.conversation.create as jest.Mock).mock
      .calls[0][0];
    expect(createCall.data.userAId).toBe(USER_A);
    expect(createCall.data.userBId).toBe(USER_B);
  });
});
