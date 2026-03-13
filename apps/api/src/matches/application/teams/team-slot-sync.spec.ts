import {
  releaseTeamSlot,
  releaseTeamSlotsBatch,
  autoAssignTeamSlot,
} from './team-slot-sync';
import { MatchAuditService } from '../audit/match-audit.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAudit() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as MatchAuditService;
}

function makeSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'slot-1',
    matchId: 'match-1',
    team: 'A',
    slotIndex: 0,
    userId: 'user-1',
    ...overrides,
  };
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    matchTeamSlot: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// releaseTeamSlot
// ---------------------------------------------------------------------------

describe('releaseTeamSlot', () => {
  it('clears the userId of the found slot and logs audit', async () => {
    const slot = makeSlot();
    const tx = makeTx();
    tx.matchTeamSlot.findFirst.mockResolvedValue(slot);
    const audit = makeAudit();

    await releaseTeamSlot(tx, 'match-1', 'user-1', 'actor-1', audit);

    expect(tx.matchTeamSlot.update).toHaveBeenCalledWith({
      where: { id: slot.id },
      data: { userId: null },
    });
    expect(audit.log).toHaveBeenCalledWith(
      tx,
      'match-1',
      'actor-1',
      'teams.slot_released',
      expect.objectContaining({ releasedUserId: 'user-1' }),
    );
  });

  it('is a no-op if user has no assigned slot', async () => {
    const tx = makeTx();
    tx.matchTeamSlot.findFirst.mockResolvedValue(null);
    const audit = makeAudit();

    await releaseTeamSlot(tx, 'match-1', 'user-1', 'actor-1', audit);

    expect(tx.matchTeamSlot.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// releaseTeamSlotsBatch
// ---------------------------------------------------------------------------

describe('releaseTeamSlotsBatch', () => {
  it('clears all matching slots and logs audit when count > 0', async () => {
    const tx = makeTx();
    tx.matchTeamSlot.updateMany.mockResolvedValue({ count: 2 });
    const audit = makeAudit();

    await releaseTeamSlotsBatch(
      tx,
      'match-1',
      ['user-1', 'user-2'],
      'actor-1',
      audit,
    );

    expect(tx.matchTeamSlot.updateMany).toHaveBeenCalledWith({
      where: { matchId: 'match-1', userId: { in: ['user-1', 'user-2'] } },
      data: { userId: null },
    });
    expect(audit.log).toHaveBeenCalledWith(
      tx,
      'match-1',
      'actor-1',
      'teams.slot_released',
      expect.objectContaining({
        releasedUserIds: ['user-1', 'user-2'],
        count: 2,
      }),
    );
  });

  it('skips updateMany and audit when userIds is empty', async () => {
    const tx = makeTx();
    const audit = makeAudit();

    await releaseTeamSlotsBatch(tx, 'match-1', [], 'actor-1', audit);

    expect(tx.matchTeamSlot.updateMany).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('does not log audit when no slots matched (count === 0)', async () => {
    const tx = makeTx();
    tx.matchTeamSlot.updateMany.mockResolvedValue({ count: 0 });
    const audit = makeAudit();

    await releaseTeamSlotsBatch(tx, 'match-1', ['user-1'], 'actor-1', audit);

    expect(tx.matchTeamSlot.updateMany).toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// autoAssignTeamSlot
// ---------------------------------------------------------------------------

describe('autoAssignTeamSlot', () => {
  it('assigns user to the first empty slot (team A before B)', async () => {
    const emptySlot = makeSlot({ userId: null, team: 'A', slotIndex: 0 });
    const tx = makeTx();
    tx.matchTeamSlot.findFirst.mockResolvedValue(emptySlot);
    const audit = makeAudit();

    await autoAssignTeamSlot(tx, 'match-1', 'user-2', 'actor-1', audit);

    expect(tx.matchTeamSlot.findFirst).toHaveBeenCalledWith({
      where: { matchId: 'match-1', userId: null },
      orderBy: [{ team: 'asc' }, { slotIndex: 'asc' }],
    });
    expect(tx.matchTeamSlot.update).toHaveBeenCalledWith({
      where: { id: emptySlot.id },
      data: { userId: 'user-2' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      tx,
      'match-1',
      'actor-1',
      'teams.slot_auto_assigned',
      expect.objectContaining({
        assignedUserId: 'user-2',
        team: 'A',
        slotIndex: 0,
      }),
    );
  });

  it('is a no-op when no empty slot exists', async () => {
    const tx = makeTx();
    tx.matchTeamSlot.findFirst.mockResolvedValue(null);
    const audit = makeAudit();

    await autoAssignTeamSlot(tx, 'match-1', 'user-2', 'actor-1', audit);

    expect(tx.matchTeamSlot.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
