import { ListUserConversationsUseCase } from './list-user-conversations.use-case';
import type { PrismaService } from '../../infra/prisma/prisma.service';

function makePrisma(): PrismaService {
  return {
    client: {
      conversation: { findMany: jest.fn() },
      conversationReadState: { findMany: jest.fn().mockResolvedValue([]) },
    },
  } as unknown as PrismaService;
}

const NOW = new Date('2026-01-01T10:00:00.000Z');
const LATER = new Date('2026-01-01T11:00:00.000Z');

function makeConv(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-1',
    type: 'MATCH',
    updatedAt: NOW,
    match: {
      id: 'match-1',
      title: 'Partido de prueba',
      status: 'scheduled',
      startsAt: NOW,
    },
    messages: [],
    ...overrides,
  };
}

describe('ListUserConversationsUseCase', () => {
  it('returns empty array when user has no conversations', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([]);
    const uc = new ListUserConversationsUseCase(prisma);
    const result = await uc.execute('user-1');
    expect(result).toEqual([]);
  });

  it('returns conversation with correct shape', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv(),
    ]);
    const uc = new ListUserConversationsUseCase(prisma);
    const result = await uc.execute('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'conv-1',
      type: 'MATCH',
      isReadOnly: false,
      match: {
        id: 'match-1',
        title: 'Partido de prueba',
        status: 'scheduled',
        startsAt: NOW.toISOString(),
      },
      lastMessage: null,
      updatedAt: NOW.toISOString(),
    });
  });

  it('does not mark isReadOnly for scheduled or locked match (active matches only)', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv({
        match: { id: 'm1', title: 'Test', status: 'locked', startsAt: NOW },
      }),
    ]);
    const uc = new ListUserConversationsUseCase(prisma);
    const [item] = await uc.execute('user-1');
    expect(item.isReadOnly).toBe(false);
  });

  it('includes lastMessage when present', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv({
        messages: [
          {
            id: 'msg-1',
            body: 'Hola a todos',
            sender: { username: 'player1' },
            createdAt: LATER,
          },
        ],
      }),
    ]);
    const uc = new ListUserConversationsUseCase(prisma);
    const [item] = await uc.execute('user-1');
    expect(item.lastMessage).toEqual({
      id: 'msg-1',
      body: 'Hola a todos',
      senderUsername: 'player1',
      createdAt: LATER.toISOString(),
    });
  });

  it('sorts conversations by last message time descending', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv({
        id: 'conv-old',
        match: { id: 'm1', title: 'Viejo', status: 'scheduled', startsAt: NOW },
        messages: [
          {
            id: 'msg-a',
            body: 'old',
            sender: { username: 'a' },
            createdAt: NOW,
          },
        ],
      }),
      makeConv({
        id: 'conv-new',
        match: {
          id: 'm2',
          title: 'Nuevo',
          status: 'scheduled',
          startsAt: LATER,
        },
        messages: [
          {
            id: 'msg-b',
            body: 'new',
            sender: { username: 'b' },
            createdAt: LATER,
          },
        ],
      }),
    ]);
    const uc = new ListUserConversationsUseCase(prisma);
    const result = await uc.execute('user-1');
    expect(result[0].id).toBe('conv-new');
    expect(result[1].id).toBe('conv-old');
  });

  it('sorts conversations without messages by updatedAt descending', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([
      makeConv({ id: 'conv-old', updatedAt: NOW, messages: [] }),
      makeConv({ id: 'conv-new', updatedAt: LATER, messages: [] }),
    ]);
    const uc = new ListUserConversationsUseCase(prisma);
    const result = await uc.execute('user-1');
    expect(result[0].id).toBe('conv-new');
    expect(result[1].id).toBe('conv-old');
  });

  it('passes correct filter to prisma (active matches only, creator OR active participant)', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findMany as jest.Mock).mockResolvedValue([]);
    const uc = new ListUserConversationsUseCase(prisma);
    await uc.execute('user-42');

    const [callArgs] = (prisma.client.conversation.findMany as jest.Mock).mock
      .calls;
    expect(callArgs[0].where).toMatchObject({
      type: 'MATCH',
      match: {
        status: { notIn: expect.arrayContaining(['played', 'canceled']) },
        OR: [
          { createdById: 'user-42' },
          {
            participants: {
              some: {
                userId: 'user-42',
                status: {
                  in: expect.arrayContaining([
                    'CONFIRMED',
                    'WAITLISTED',
                    'SPECTATOR',
                  ]),
                },
              },
            },
          },
        ],
      },
    });
  });
});
