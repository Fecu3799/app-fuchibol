import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { StorageModule } from '../infra/storage/storage.module';
import { UsersController } from './api/users.controller';
import { LookupUserQuery } from './application/lookup-user.query';
import { GetPublicProfileQuery } from './application/get-public-profile.query';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [UsersController],
  providers: [LookupUserQuery, GetPublicProfileQuery],
})
export class UsersModule {}
