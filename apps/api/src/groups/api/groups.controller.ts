import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Actor } from '../../auth/decorators/actor.decorator';
import type { ActorPayload } from '../../auth/interfaces/actor-payload.interface';
import { CreateGroupUseCase } from '../application/create-group.use-case';
import { ListGroupsQuery } from '../application/list-groups.query';
import { GetGroupQuery } from '../application/get-group.query';
import { AddMemberUseCase } from '../application/add-member.use-case';
import { RemoveMemberUseCase } from '../application/remove-member.use-case';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly createGroupUseCase: CreateGroupUseCase,
    private readonly listGroupsQuery: ListGroupsQuery,
    private readonly getGroupQuery: GetGroupQuery,
    private readonly addMemberUseCase: AddMemberUseCase,
    private readonly removeMemberUseCase: RemoveMemberUseCase,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post()
  async create(@Body() body: CreateGroupDto, @Actor() actor: ActorPayload) {
    return this.createGroupUseCase.execute({
      name: body.name,
      actorId: actor.userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Actor() actor: ActorPayload) {
    return this.listGroupsQuery.execute(actor.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Actor() actor: ActorPayload,
  ) {
    return this.getGroupQuery.execute(id, actor.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/members')
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddMemberDto,
    @Actor() actor: ActorPayload,
  ) {
    return this.addMemberUseCase.execute({
      groupId: id,
      actorId: actor.userId,
      identifier: body.identifier,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Actor() actor: ActorPayload,
  ) {
    await this.removeMemberUseCase.execute({
      groupId: id,
      targetUserId: userId,
      actorId: actor.userId,
    });
  }
}
