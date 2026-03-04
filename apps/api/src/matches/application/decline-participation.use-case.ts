import { Injectable, NotImplementedException } from '@nestjs/common';
import type { MatchSnapshot } from './build-match-snapshot';

export interface DeclineInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

/**
 * DEPRECATED — this use-case is being replaced by the "reject" action in PR 2.
 * The DECLINED participant status has been removed from the DB schema.
 */
@Injectable()
export class DeclineParticipationUseCase {
  execute(_input: DeclineInput): Promise<MatchSnapshot> {
    throw new NotImplementedException('DECLINE_REMOVED');
  }
}
