import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface LookupResult {
  id: string;
  username: string;
  email: string;
}

@Injectable()
export class LookupUserQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: string): Promise<LookupResult> {
    const isEmail = query.includes('@');

    const user = await this.prisma.client.user.findFirst({
      where: isEmail
        ? { email: query.toLowerCase().trim() }
        : { username: query.toLowerCase().trim() },
      select: { id: true, username: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
