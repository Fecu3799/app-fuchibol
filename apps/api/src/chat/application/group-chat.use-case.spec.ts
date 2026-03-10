import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GroupChatAccessService } from './group-chat-access.service';
import { GetGroupConversationUseCase } from './get-group-conversation.use-case';
import { ListGroupConversationsUseCase } from './list-group-conversations.use-case';
import type { PrismaService } from '../../infra/prisma/prisma.service';

// ── helpers ──

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return {
    client: {
      groupMember: { findUnique: jest.fn() },
      conversation: { findUnique: jest.fn(), findMany: jest.fn() },
      ...overrides,
    },
  } as unknown as PrismaService;
}

const NOW = new Date('2026-01-01T10:00:00.000Z');
const LATER = new Date('2026-01-01T11:00:00.000Z');

// ── GroupChatAccessService ──

describe('GroupChatAccessService', () => {
  it('returns true when user is a group member', async () => {
    const prisma = makePrisma();
    (prisma.client.groupMember.findUnique as jest.Mock).mockResolvedValue({
      groupId: 'g1',
    });
    const svc = new GroupChatAccessService(prisma);
    expect(await svc.checkAccess('g1', 'user-1')).toBe(true);
  });

  it('returns false when user is not a group member', async () => {
    const prisma = makePrisma();
    (prisma.client.groupMember.findUnique as jest.Mock).mockResolvedValue(null);
    const svc = new GroupChatAccessService(prisma);
    expect(await svc.checkAccess('g1', 'user-1')).toBe(false);
  });
});

// ── GetGroupConversationUseCase ──

describe('GetGroupConversationUseCase', () => {
  function makeAccess(allowed: boolean): GroupChatAccessService {
    return {
      checkAccess: jest.fn().mockResolvedValue(allowed),
    } as unknown as GroupChatAccessService;
  }

  it('throws CHAT_ACCESS_DENIED when user is not a member', async () => {
    const prisma = makePrisma();
    const uc = new GetGroupConversationUseCase(prisma, makeAccess(false));
    await expect(uc.execute('g1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws CONVERSATION_NOT_FOUND when conversation is missing', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    const uc = new GetGroupConversationUseCase(prisma, makeAccess(true));
    await expect(uc.execute('g1', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('returns conversation with isReadOnly false for members', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue({
      id: 'conv-1',
      type: 'GROUP',
    });
    const uc = new GetGroupConversationUseCase(prisma, makeAccess(true));
    const result = await uc.execute('g1', 'user-1');
    expect(result).toEqual({ id: 'conv-1', type: 'GROUP', isReadOnly: false });
  });
});

// ── ListGroupConversationsUseCase ──

describe('ListGroupConversationsUseCase', () => {
  function makeConv(overrides: Record<string, unknown> = {}) {
    return {
      id: 'conv-1',
      type: 'GROUP',
      updatedAt: NOW,
      group: { id: 'g1', name: 'Fútbol 5 Miércoles' },
      messages: [],
      ...overrides,
    };
  }

  it('returns empty array when user has no group conversations', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([]);
    const uc = new ListGroupConversationsUseCase(prisma);
    expect(await uc.execute('user-1')).toEqual([]);
  });

  it('returns conversation with correct shape', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv(),
    ]);
    const uc = new ListGroupConversationsUseCase(prisma);
    const [item] = await uc.execute('user-1');
    expect(item).toMatchObject({
      id: 'conv-1',
      type: 'GROUP',
      group: { id: 'g1', name: 'Fútbol 5 Miércoles' },
      lastMessage: null,
      updatedAt: NOW.toISOString(),
    });
  });

  it('includes lastMessage when present', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv({
        messages: [
          {
            id: 'msg-1',
            body: '¿A qué hora?',
            sender: { username: 'player1' },
            createdAt: LATER,
          },
        ],
      }),
    ]);
    const uc = new ListGroupConversationsUseCase(prisma);
    const [item] = await uc.execute('user-1');
    expect(item.lastMessage).toEqual({
      id: 'msg-1',
      body: '¿A qué hora?',
      senderUsername: 'player1',
      createdAt: LATER.toISOString(),
    });
  });

  it('sorts by last message time descending', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv({
        id: 'conv-old',
        group: { id: 'g1', name: 'Grupo A' },
        messages: [
          { id: 'm1', body: 'old', sender: { username: 'a' }, createdAt: NOW },
        ],
      }),
      makeConv({
        id: 'conv-new',
        group: { id: 'g2', name: 'Grupo B' },
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
    const uc = new ListGroupConversationsUseCase(prisma);
    const result = await uc.execute('user-1');
    expect(result[0].id).toBe('conv-new');
    expect(result[1].id).toBe('conv-old');
  });

  it('passes correct membership filter to prisma', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([]);
    const uc = new ListGroupConversationsUseCase(prisma);
    await uc.execute('user-42');
    const [callArgs] = (prisma.client.conversation.findMany as jest.Mock).mock
      .calls;
    expect(callArgs[0].where).toMatchObject({
      type: 'GROUP',
      group: { members: { some: { userId: 'user-42' } } },
    });
  });
});
