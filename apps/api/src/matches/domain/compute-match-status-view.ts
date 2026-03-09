export type MatchStatusView = 'CANCELLED' | 'IN_PROGRESS' | 'PLAYED' | 'UPCOMING';

/**
 * Maps the DB status to a display status. Fully DB-driven — no time calculations.
 * - canceled → CANCELLED
 * - in_progress → IN_PROGRESS
 * - played → PLAYED
 * - scheduled / locked → UPCOMING
 */
export function computeMatchStatusView(
  match: { status: string },
): MatchStatusView {
  if (match.status === 'canceled') return 'CANCELLED';
  if (match.status === 'in_progress') return 'IN_PROGRESS';
  if (match.status === 'played') return 'PLAYED';
  return 'UPCOMING';
}
