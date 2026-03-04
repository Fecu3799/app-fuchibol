import { IsUUID } from 'class-validator';

export class InviteCandidatesQueryDto {
  @IsUUID()
  groupId: string;
}
