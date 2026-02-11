export class MatchSnapshotDto {
  id: string;
  title: string;
  startsAt: Date;
  capacity: number;
  status: string;
  revision: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export class GetMatchResponseDto {
  match: MatchSnapshotDto;
}
