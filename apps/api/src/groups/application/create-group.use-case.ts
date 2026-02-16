import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface CreateGroupInput {
  name: string;
  actorId: string;
}

export interface CreateGroupResult {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

@Injectable()
export class CreateGroupUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateGroupInput): Promise<CreateGroupResult> {
    return this.prisma.client.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: input.name,
          ownerId: input.actorId,
        },
      });

      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: input.actorId,
        },
      });

      return {
        id: group.id,
        name: group.name,
        ownerId: group.ownerId,
        createdAt: group.createdAt,
      };
    });
  }
}
