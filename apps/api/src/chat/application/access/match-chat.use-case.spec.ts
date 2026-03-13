import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MatchChatAccessService } from './match-chat-access.service';
import { GetMatchConversationUseCase } from '../conversations/get-match-conversation.use-case';
import { SendMessageUseCase } from '../messages/send-message.use-case';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { StorageService } from '../../../infra/storage/storage.service';

// ---- helpers ----

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return {
    client: {
      match: { findUnique: jest.fn() },
      matchParticipant: { findUnique: jest.fn() },
      conversation: { findUnique: jest.fn() },
      message: { findUnique: jest.fn(), create: jest.fn() },
      ...overrides,
    },
  } as unknown as PrismaService;
}

function makeStorage(): StorageService {
  return {
    buildPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
  } as unknown as StorageService;
}

function makeGroupAccess() {
  return {
    checkAccess: jest.fn().mockResolvedValue(false),
  } as unknown as import('./group-chat-access.service').GroupChatAccessService;
}

function makeDirectAccess() {
  return {
    checkAccess: jest.fn().mockResolvedValue(false),
  } as unknown as import('./direct-chat-access.service').DirectChatAccessService;
}

// ---- MatchChatAccessService ----

describe('MatchChatAccessService', () => {
  it('allows creator regardless of status', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'user-1',
      status: 'scheduled',
    });
    const svc = new MatchChatAccessService(prisma);
    const result = await svc.checkAccess('match-1', 'user-1');
    expect(result).toEqual({ allowed: true, isReadOnly: false });
  });

  it('allows CONFIRMED participant', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'creator',
      status: 'scheduled',
    });
    (prisma.client.matchParticipant.findUnique as jest.Mock).mockResolvedValue({
      status: 'CONFIRMED',
    });
    const svc = new MatchChatAccessService(prisma);
    const result = await svc.checkAccess('match-1', 'user-2');
    expect(result).toEqual({ allowed: true, isReadOnly: false });
  });

  it('allows WAITLISTED participant', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'creator',
      status: 'scheduled',
    });
    (prisma.client.matchParticipant.findUnique as jest.Mock).mockResolvedValue({
      status: 'WAITLISTED',
    });
    const svc = new MatchChatAccessService(prisma);
    const result = await svc.checkAccess('match-1', 'user-2');
    expect(result).toEqual({ allowed: true, isReadOnly: false });
  });

  it('allows SPECTATOR participant', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'creator',
      status: 'scheduled',
    });
    (prisma.client.matchParticipant.findUnique as jest.Mock).mockResolvedValue({
      status: 'SPECTATOR',
    });
    const svc = new MatchChatAccessService(prisma);
    const result = await svc.checkAccess('match-1', 'user-2');
    expect(result).toEqual({ allowed: true, isReadOnly: false });
  });

  it('denies INVITED participant', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'creator',
      status: 'scheduled',
    });
    (prisma.client.matchParticipant.findUnique as jest.Mock).mockResolvedValue({
      status: 'INVITED',
    });
    const svc = new MatchChatAccessService(prisma);
    const result = await svc.checkAccess('match-1', 'user-2');
    expect(result).toEqual({ allowed: false, isReadOnly: false });
  });

  it('denies user with no participant row', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'creator',
      status: 'scheduled',
    });
    (prisma.client.matchParticipant.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    const svc = new MatchChatAccessService(prisma);
    const result = await svc.checkAccess('match-1', 'outsider');
    expect(result).toEqual({ allowed: false, isReadOnly: false });
  });

  it('marks isReadOnly for played match', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'creator',
      status: 'played',
    });
    const svc = new MatchChatAccessService(prisma);
    const result = await svc.checkAccess('match-1', 'creator');
    expect(result).toEqual({ allowed: true, isReadOnly: true });
  });

  it('marks isReadOnly for canceled match', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'creator',
      status: 'canceled',
    });
    const svc = new MatchChatAccessService(prisma);
    const result = await svc.checkAccess('match-1', 'creator');
    expect(result).toEqual({ allowed: true, isReadOnly: true });
  });

  it('returns not allowed when match not found', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue(null);
    const svc = new MatchChatAccessService(prisma);
    const result = await svc.checkAccess('match-x', 'user-1');
    expect(result).toEqual({ allowed: false, isReadOnly: false });
  });
});

// ---- GetMatchConversationUseCase ----

describe('GetMatchConversationUseCase', () => {
  it('returns conversation for allowed user', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'user-1',
      status: 'scheduled',
    });
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue({
      id: 'conv-1',
      type: 'MATCH',
    });
    const access = new MatchChatAccessService(prisma);
    const useCase = new GetMatchConversationUseCase(prisma, access);
    const result = await useCase.execute('match-1', 'user-1');
    expect(result).toEqual({ id: 'conv-1', type: 'MATCH', isReadOnly: false });
  });

  it('throws 403 for user with no access', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'creator',
      status: 'scheduled',
    });
    (prisma.client.matchParticipant.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    const access = new MatchChatAccessService(prisma);
    const useCase = new GetMatchConversationUseCase(prisma, access);
    await expect(useCase.execute('match-1', 'outsider')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws 404 if conversation missing', async () => {
    const prisma = makePrisma();
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'user-1',
      status: 'scheduled',
    });
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    const access = new MatchChatAccessService(prisma);
    const useCase = new GetMatchConversationUseCase(prisma, access);
    await expect(useCase.execute('match-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

// ---- SendMessageUseCase ----

describe('SendMessageUseCase', () => {
  const baseConv = { type: 'MATCH', matchId: 'match-1' };
  const baseMatch = { createdById: 'creator', status: 'scheduled' };
  const baseMessage = {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'creator',
    body: 'Hello',
    clientMsgId: 'client-uuid',
    createdAt: new Date(),
    sender: { username: 'creator_user', avatar: null },
  };

  it('creates and returns message for allowed sender', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      baseConv,
    );
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue(baseMatch);
    (prisma.client.message.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.client.message.create as jest.Mock).mockResolvedValue(baseMessage);
    const access = new MatchChatAccessService(prisma);
    const storage = makeStorage();
    const useCase = new SendMessageUseCase(
      prisma,
      access,
      makeGroupAccess(),
      makeDirectAccess(),
      storage,
    );
    const { message } = await useCase.execute({
      conversationId: 'conv-1',
      senderId: 'creator',
      body: 'Hello',
      clientMsgId: 'client-uuid',
    });
    expect(message.id).toBe('msg-1');
    expect(message.body).toBe('Hello');
    expect(message.senderAvatarUrl).toBeNull();
  });

  it('returns existing message (idempotency)', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      baseConv,
    );
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue(baseMatch);
    (prisma.client.message.findUnique as jest.Mock).mockResolvedValue(
      baseMessage,
    );
    const access = new MatchChatAccessService(prisma);
    const storage = makeStorage();
    const useCase = new SendMessageUseCase(
      prisma,
      access,
      makeGroupAccess(),
      makeDirectAccess(),
      storage,
    );
    await useCase.execute({
      conversationId: 'conv-1',
      senderId: 'creator',
      body: 'Hello',
      clientMsgId: 'client-uuid',
    });
    expect(prisma.client.message.create).not.toHaveBeenCalled();
  });

  it('throws 403 for access denied', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      baseConv,
    );
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'creator',
      status: 'scheduled',
    });
    (prisma.client.matchParticipant.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    const access = new MatchChatAccessService(prisma);
    const storage = makeStorage();
    const useCase = new SendMessageUseCase(
      prisma,
      access,
      makeGroupAccess(),
      makeDirectAccess(),
      storage,
    );
    await expect(
      useCase.execute({
        conversationId: 'conv-1',
        senderId: 'outsider',
        body: 'Hi',
        clientMsgId: 'some-uuid',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 422 CHAT_READ_ONLY for played match', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      baseConv,
    );
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue({
      createdById: 'creator',
      status: 'played',
    });
    const access = new MatchChatAccessService(prisma);
    const storage = makeStorage();
    const useCase = new SendMessageUseCase(
      prisma,
      access,
      makeGroupAccess(),
      makeDirectAccess(),
      storage,
    );
    await expect(
      useCase.execute({
        conversationId: 'conv-1',
        senderId: 'creator',
        body: 'Hi',
        clientMsgId: 'some-uuid',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('resolves avatar url when avatar key present', async () => {
    const prisma = makePrisma();
    (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
      baseConv,
    );
    (prisma.client.match.findUnique as jest.Mock).mockResolvedValue(baseMatch);
    (prisma.client.message.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.client.message.create as jest.Mock).mockResolvedValue({
      ...baseMessage,
      sender: { username: 'creator_user', avatar: { key: 'avatars/abc.jpg' } },
    });
    const access = new MatchChatAccessService(prisma);
    const storage = makeStorage();
    const useCase = new SendMessageUseCase(
      prisma,
      access,
      makeGroupAccess(),
      makeDirectAccess(),
      storage,
    );
    const { message } = await useCase.execute({
      conversationId: 'conv-1',
      senderId: 'creator',
      body: 'Hello',
      clientMsgId: 'client-uuid-2',
    });
    expect(message.senderAvatarUrl).toBe(
      'https://cdn.example.com/avatars/abc.jpg',
    );
  });
});
