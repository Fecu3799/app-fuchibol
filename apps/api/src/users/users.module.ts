import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { UsersController } from './api/users.controller';
import { LookupUserQuery } from './application/lookup-user.query';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [LookupUserQuery],
})
export class UsersModule {}
