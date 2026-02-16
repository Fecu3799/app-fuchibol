import { computeMatchStatusView } from './compute-match-status-view';

describe('computeMatchStatusView', () => {
  const startsAt = new Date('2026-06-01T18:00:00Z');

  it('returns CANCELLED when match status is canceled', () => {
    const result = computeMatchStatusView(
      { status: 'canceled', startsAt },
      new Date('2026-06-01T17:00:00Z'),
    );
    expect(result).toBe('CANCELLED');
  });

  it('returns CANCELLED even if match is past + canceled (canceled takes priority)', () => {
    const result = computeMatchStatusView(
      { status: 'canceled', startsAt },
      new Date('2026-06-02T00:00:00Z'),
    );
    expect(result).toBe('CANCELLED');
  });

  it('returns UPCOMING when now is before startsAt', () => {
    const result = computeMatchStatusView(
      { status: 'scheduled', startsAt },
      new Date('2026-06-01T17:00:00Z'),
    );
    expect(result).toBe('UPCOMING');
  });

  it('returns UPCOMING when now is exactly at startsAt (game just started)', () => {
    const result = computeMatchStatusView(
      { status: 'scheduled', startsAt },
      new Date('2026-06-01T18:00:00Z'),
    );
    expect(result).toBe('UPCOMING');
  });

  it('returns UPCOMING when now is 59m59s after startsAt (not yet 1h)', () => {
    const result = computeMatchStatusView(
      { status: 'scheduled', startsAt },
      new Date('2026-06-01T18:59:59.999Z'),
    );
    expect(result).toBe('UPCOMING');
  });

  it('returns PLAYED when now is exactly startsAt + 1h', () => {
    const result = computeMatchStatusView(
      { status: 'scheduled', startsAt },
      new Date('2026-06-01T19:00:00Z'),
    );
    expect(result).toBe('PLAYED');
  });

  it('returns PLAYED when now is well past startsAt + 1h', () => {
    const result = computeMatchStatusView(
      { status: 'locked', startsAt },
      new Date('2026-06-02T00:00:00Z'),
    );
    expect(result).toBe('PLAYED');
  });

  it('returns UPCOMING for locked match that has not started yet', () => {
    const result = computeMatchStatusView(
      { status: 'locked', startsAt },
      new Date('2026-06-01T17:30:00Z'),
    );
    expect(result).toBe('UPCOMING');
  });
});
