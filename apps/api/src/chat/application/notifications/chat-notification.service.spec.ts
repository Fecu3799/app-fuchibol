import { Test } from '@nestjs/testing';
import { ChatNotificationService } from './chat-notification.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { REDIS_CLIENT } from '../../../infra/redis/redis.module';
import {
  NOTIFICATION_PROVIDER,
  NotificationProvider,
} from '../../../push/notification-provider.interface';
import { ChatRealtimePublisher } from '../../realtime/chat-realtime.publisher';
import type { MessageView } from '../messages/list-messages.use-case';

function makeMessage(overrides: Partial<MessageView> = {}): MessageView {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'sender-id',
    senderUsername: 'alice',
    senderAvatarUrl: null,
    body: 'Hello!',
    clientMsgId: 'client-1',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('ChatNotificationService', () => {
  let service: ChatNotificationService;

  let prisma: any;
  let provider: jest.Mocked<NotificationProvider>;
  let realtimePublisher: jest.Mocked<ChatRealtimePublisher>;

  let redis: any;

  beforeEach(async () => {
    prisma = {
      client: {
        conversation: { findUnique: jest.fn() },
        matchParticipant: { findMany: jest.fn() },
        groupMember: { findMany: jest.fn() },
        // userSettings.findMany returns [] by default (no preferences disabled)
        userSettings: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };

    provider = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    realtimePublisher = {
      setServer: jest.fn(),
      notifyNewMessage: jest.fn(),
      notifyConversationUpdated: jest.fn(),
    } as unknown as jest.Mocked<ChatRealtimePublisher>;
    // Default: no users are actively viewing (mget returns all nulls)
    redis = { mget: jest.fn().mockResolvedValue([null, null, null, null]) };

    const module = await Test.createTestingModule({
      providers: [
        ChatNotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatRealtimePublisher, useValue: realtimePublisher },
        { provide: NOTIFICATION_PROVIDER, useValue: provider },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(ChatNotificationService);
  });

  describe('MATCH conversation', () => {
    const conversation = {
      id: 'conv-1',
      type: 'MATCH',
      matchId: 'match-1',
      groupId: null,
      userAId: null,
      userBId: null,
      match: { title: 'Partido del Martes' },
      group: null,
    };

    beforeEach(() => {
      (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
    });

    it('sends push to all active participants except sender', async () => {
      (prisma.client.matchParticipant.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-b' },
        { userId: 'user-c' },
      ]);

      const message = makeMessage({ senderId: 'sender-id' });
      await service.onMessageCreated(message);

      expect(provider.sendToUser).toHaveBeenCalledTimes(2);
      expect(provider.sendToUser).toHaveBeenCalledWith(
        'user-b',
        expect.any(Object),
      );
      expect(provider.sendToUser).toHaveBeenCalledWith(
        'user-c',
        expect.any(Object),
      );
    });

    it('does not send push to sender', async () => {
      (prisma.client.matchParticipant.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      const message = makeMessage({ senderId: 'sender-id' });
      await service.onMessageCreated(message);

      expect(provider.sendToUser).not.toHaveBeenCalled();
    });

    it('excludes sender from query (not: senderId passed to Prisma)', async () => {
      (prisma.client.matchParticipant.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      const message = makeMessage({ senderId: 'sender-id' });
      await service.onMessageCreated(message);

      expect(prisma.client.matchParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: { not: 'sender-id' } }),
        }),
      );
    });

    it('only queries CONFIRMED, WAITLISTED, SPECTATOR (not INVITED)', async () => {
      (prisma.client.matchParticipant.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      await service.onMessageCreated(makeMessage());

      const call = (prisma.client.matchParticipant.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where.status.in).toEqual(
        expect.arrayContaining(['CONFIRMED', 'WAITLISTED', 'SPECTATOR']),
      );
      expect(call.where.status.in).not.toContain('INVITED');
    });

    it('builds correct push payload with match title', async () => {
      (prisma.client.matchParticipant.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-b' },
      ]);

      const message = makeMessage({
        body: 'Nos vemos!',
        senderUsername: 'alice',
      });
      await service.onMessageCreated(message);

      expect(provider.sendToUser).toHaveBeenCalledWith('user-b', {
        title: 'Partido del Martes',
        body: 'alice: Nos vemos!',
        data: {
          type: 'chat_message',
          conversationType: 'MATCH',
          matchId: 'match-1',
        },
      });
    });
  });

  describe('GROUP conversation', () => {
    const conversation = {
      id: 'conv-1',
      type: 'GROUP',
      matchId: null,
      groupId: 'group-1',
      userAId: null,
      userBId: null,
      match: null,
      group: { name: 'Los Pibes' },
    };

    beforeEach(() => {
      (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
    });

    it('sends push to all group members except sender', async () => {
      (prisma.client.groupMember.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-b' },
        { userId: 'user-c' },
      ]);

      await service.onMessageCreated(makeMessage());

      expect(provider.sendToUser).toHaveBeenCalledTimes(2);
    });

    it('builds correct push payload with group name', async () => {
      (prisma.client.groupMember.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-b' },
      ]);

      const message = makeMessage({ body: 'Hola!', senderUsername: 'alice' });
      await service.onMessageCreated(message);

      expect(provider.sendToUser).toHaveBeenCalledWith('user-b', {
        title: 'Los Pibes',
        body: 'alice: Hola!',
        data: {
          type: 'chat_message',
          conversationType: 'GROUP',
          groupId: 'group-1',
          groupName: 'Los Pibes',
        },
      });
    });
  });

  describe('DIRECT conversation', () => {
    const conversation = {
      id: 'conv-1',
      type: 'DIRECT',
      matchId: null,
      groupId: null,
      userAId: 'sender-id',
      userBId: 'user-b',
      match: null,
      group: null,
    };

    beforeEach(() => {
      (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
    });

    it('sends push to the other user only', async () => {
      const message = makeMessage({ senderId: 'sender-id' });
      await service.onMessageCreated(message);

      expect(provider.sendToUser).toHaveBeenCalledTimes(1);
      expect(provider.sendToUser).toHaveBeenCalledWith(
        'user-b',
        expect.any(Object),
      );
    });

    it('does not push to sender', async () => {
      const message = makeMessage({ senderId: 'user-b' });
      await service.onMessageCreated(message);

      expect(provider.sendToUser).toHaveBeenCalledWith(
        'sender-id',
        expect.any(Object),
      );
      expect(provider.sendToUser).not.toHaveBeenCalledWith(
        'user-b',
        expect.any(Object),
      );
    });

    it('builds correct direct push payload', async () => {
      const message = makeMessage({
        senderId: 'sender-id',
        body: 'Hola!',
        senderUsername: 'alice',
      });
      await service.onMessageCreated(message);

      expect(provider.sendToUser).toHaveBeenCalledWith('user-b', {
        title: 'alice',
        body: 'Hola!',
        data: {
          type: 'chat_message',
          conversationType: 'DIRECT',
          conversationId: 'conv-1',
          otherUsername: 'alice',
        },
      });
    });
  });

  describe('body truncation', () => {
    it('truncates messages longer than 100 chars', async () => {
      const conversation = {
        id: 'conv-1',
        type: 'DIRECT',
        matchId: null,
        groupId: null,
        userAId: 'sender-id',
        userBId: 'user-b',
        match: null,
        group: null,
      };
      (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );

      const longBody = 'a'.repeat(150);
      const message = makeMessage({ senderId: 'sender-id', body: longBody });
      await service.onMessageCreated(message);

      const [, payload] = (provider.sendToUser as jest.Mock).mock.calls[0];
      expect(payload.body.length).toBeLessThanOrEqual(102); // 100 + '…'
      expect(payload.body.endsWith('…')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('does nothing if conversation is not found', async () => {
      (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await service.onMessageCreated(makeMessage());

      expect(provider.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe('Redis push suppression (active viewers)', () => {
    const directConversation = {
      id: 'conv-1',
      type: 'DIRECT',
      matchId: null,
      groupId: null,
      userAId: 'sender-id',
      userBId: 'user-b',
      match: null,
      group: null,
    };

    beforeEach(() => {
      (prisma.client.conversation.findUnique as jest.Mock).mockResolvedValue(
        directConversation,
      );
    });

    it('skips push to recipient who is actively viewing the conversation', async () => {
      // user-b is actively viewing → mget returns '1' for their key
      redis.mget.mockResolvedValue(['1']);

      await service.onMessageCreated(makeMessage({ senderId: 'sender-id' }));

      expect(provider.sendToUser).not.toHaveBeenCalled();
    });

    it('sends push to recipient who is NOT actively viewing', async () => {
      // user-b is not viewing → mget returns null
      redis.mget.mockResolvedValue([null]);

      await service.onMessageCreated(makeMessage({ senderId: 'sender-id' }));

      expect(provider.sendToUser).toHaveBeenCalledTimes(1);
      expect(provider.sendToUser).toHaveBeenCalledWith(
        'user-b',
        expect.any(Object),
      );
    });

    it('fails open when Redis is null (no suppression)', async () => {
      // Re-create service without Redis
      const module = await Test.createTestingModule({
        providers: [
          ChatNotificationService,
          { provide: PrismaService, useValue: prisma },
          { provide: ChatRealtimePublisher, useValue: realtimePublisher },
          { provide: NOTIFICATION_PROVIDER, useValue: provider },
          { provide: REDIS_CLIENT, useValue: null },
        ],
      }).compile();
      const serviceNoRedis = module.get(ChatNotificationService);

      await serviceNoRedis.onMessageCreated(
        makeMessage({ senderId: 'sender-id' }),
      );

      expect(provider.sendToUser).toHaveBeenCalledWith(
        'user-b',
        expect.any(Object),
      );
    });
  });
});
