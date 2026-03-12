import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MarkConversationReadUseCase } from './mark-conversation-read.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

describe('MarkConversationReadUseCase', () => {
  let prisma: any;
  let useCase: MarkConversationReadUseCase;

  beforeEach(async () => {
    prisma = {
      client: {
        conversation: { findUnique: jest.fn() },
        conversationReadState: { upsert: jest.fn() },
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        MarkConversationReadUseCase,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    useCase = module.get(MarkConversationReadUseCase);
  });

  it('upserts read state for existing conversation', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv-1' });
    prisma.client.conversationReadState.upsert.mockResolvedValue({});

    await useCase.execute('conv-1', 'user-1');

    expect(prisma.client.conversationReadState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_conversationId: { userId: 'user-1', conversationId: 'conv-1' },
        },
        create: expect.objectContaining({
          userId: 'user-1',
          conversationId: 'conv-1',
        }),
        update: expect.objectContaining({ lastReadAt: expect.any(Date) }),
      }),
    );
  });

  it('throws NotFoundException if conversation does not exist', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue(null);

    await expect(useCase.execute('conv-missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.client.conversationReadState.upsert).not.toHaveBeenCalled();
  });
});
