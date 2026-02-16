export type MatchStatusView = 'CANCELLED' | 'PLAYED' | 'UPCOMING';

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Derives the display status for a match without persisting to DB.
 * - canceled in DB => CANCELLED
 * - now >= startsAt + 1h => PLAYED
 * - otherwise => UPCOMING
 */
export function computeMatchStatusView(
  match: { status: string; startsAt: Date },
  now: Date = new Date(),
): MatchStatusView {
  if (match.status === 'canceled') return 'CANCELLED';
  if (now.getTime() >= match.startsAt.getTime() + ONE_HOUR_MS) return 'PLAYED';
  return 'UPCOMING';
}
