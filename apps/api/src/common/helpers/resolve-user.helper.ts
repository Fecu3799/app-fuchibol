import { NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

interface ResolveUserInput {
  targetUserId?: string;
  identifier?: string;
}

export async function resolveUser(
  prisma: PrismaClient,
  input: ResolveUserInput,
): Promise<string> {
  if (input.targetUserId) {
    return input.targetUserId;
  }

  const raw = input.identifier!.trim();
  let where: { username: string } | { email: string };

  if (raw.startsWith('@')) {
    where = { username: raw.slice(1).toLowerCase() };
  } else if (raw.includes('@')) {
    where = { email: raw.toLowerCase() };
  } else {
    where = { username: raw.toLowerCase() };
  }

  const user = await prisma.user.findFirst({ where });
  if (!user) {
    throw new NotFoundException('USER_NOT_FOUND');
  }
  return user.id;
}
