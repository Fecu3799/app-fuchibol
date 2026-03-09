import { computeMatchStatusView } from './compute-match-status-view';

describe('computeMatchStatusView', () => {
  it('returns CANCELLED for canceled status', () => {
    expect(computeMatchStatusView({ status: 'canceled' })).toBe('CANCELLED');
  });

  it('returns IN_PROGRESS for in_progress status', () => {
    expect(computeMatchStatusView({ status: 'in_progress' })).toBe('IN_PROGRESS');
  });

  it('returns PLAYED for played status', () => {
    expect(computeMatchStatusView({ status: 'played' })).toBe('PLAYED');
  });

  it('returns UPCOMING for scheduled status', () => {
    expect(computeMatchStatusView({ status: 'scheduled' })).toBe('UPCOMING');
  });

  it('returns UPCOMING for locked status', () => {
    expect(computeMatchStatusView({ status: 'locked' })).toBe('UPCOMING');
  });
});
