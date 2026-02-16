import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { GroupsController } from './api/groups.controller';
import { CreateGroupUseCase } from './application/create-group.use-case';
import { ListGroupsQuery } from './application/list-groups.query';
import { GetGroupQuery } from './application/get-group.query';
import { AddMemberUseCase } from './application/add-member.use-case';
import { RemoveMemberUseCase } from './application/remove-member.use-case';

@Module({
  imports: [PrismaModule],
  controllers: [GroupsController],
  providers: [
    CreateGroupUseCase,
    ListGroupsQuery,
    GetGroupQuery,
    AddMemberUseCase,
    RemoveMemberUseCase,
  ],
})
export class GroupsModule {}
