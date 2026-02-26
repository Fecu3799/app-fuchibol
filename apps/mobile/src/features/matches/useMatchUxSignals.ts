import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchSnapshot } from '../../types/api';

// ── Types ──

export type BannerType = 'canceled' | 'reconfirm' | 'promoted' | 'reconnecting';

export interface BannerInfo {
  type: BannerType;
  message: string;
  dismissible?: boolean;
}

export interface MatchUxSignals {
  banner: BannerInfo | null;
  dismissPromoted: () => void;
}

/**
 * Derives persistent banner signals from the match snapshot and WS status.
 *
 * Banner priority (highest first):
 *   1. canceled     — match.status === 'canceled'
 *   2. reconfirm    — myStatus === 'INVITED' with 'confirm' in actionsAllowed
 *                     Signal: backend resets confirmed→invited on major changes.
 *                     Also covers freshly-invited users (acceptable overlap for MVP).
 *   3. promoted     — session-only WAITLISTED→CONFIRMED transition (useRef, no cross-session)
 *   4. reconnecting — wsConnected strictly false (null = unknown, no banner)
 */
export function useMatchUxSignals(
  match: MatchSnapshot | null | undefined,
  wsConnected: boolean | null,
): MatchUxSignals {
  // ── Promoted banner (session-only transition detection) ──
  const prevMyStatusRef = useRef<string | null | undefined>(undefined);
  const [promotedShowing, setPromotedShowing] = useState(false);

  useEffect(() => {
    if (!match) return;
    const prev = prevMyStatusRef.current;
    const curr = match.myStatus;
    // Detect WAITLISTED→CONFIRMED within this screen session
    if (prev === 'WAITLISTED' && curr === 'CONFIRMED') {
      setPromotedShowing(true);
    }
    prevMyStatusRef.current = curr;
  }, [match?.myStatus]);

  const dismissPromoted = useCallback(() => {
    setPromotedShowing(false);
  }, []);

  // ── Banner (strict priority) ──
  let banner: BannerInfo | null = null;

  if (match?.status === 'canceled') {
    banner = { type: 'canceled', message: 'Este partido fue cancelado.' };
  } else if (
    match?.myStatus === 'INVITED' &&
    match.actionsAllowed.includes('confirm')
  ) {
    banner = {
      type: 'reconfirm',
      message: 'Hubo cambios importantes. Confirmá tu asistencia.',
    };
  } else if (promotedShowing) {
    banner = {
      type: 'promoted',
      message: '¡Pasaste de la lista de espera a confirmado!',
      dismissible: true,
    };
  } else if (wsConnected === false && match != null) {
    // Only show reconnecting if we have data; avoids false alarm on initial load
    banner = { type: 'reconnecting', message: 'Reconectando…' };
  }

  return { banner, dismissPromoted };
}
