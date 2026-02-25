import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getMatchSocket } from '../../lib/socket';

interface MatchUpdatedPayload {
  matchId: string;
  revision: number;
}

/**
 * Subscribes to realtime match updates via Socket.IO.
 *
 * Coalesce logic (anti-spam):
 *   - While a GET is in flight, extra `match.updated` events set `pendingRefetch=true`
 *     instead of firing new GETs.
 *   - After the GET resolves, if `pendingRefetch` is set AND the latest seen revision
 *     is still ahead of the local revision, exactly one more GET is executed.
 *
 * Reconnect resync:
 *   - On every `connect` event (first connect or any reconnect) the hook re-emits
 *     `match.subscribe` with the current known revision and forces one GET to
 *     converge with any state changes that arrived while disconnected.
 *
 * Manual verification:
 *   1. Coalesce: trigger 10 rapid mutations from another client → the hook should
 *      produce at most 2 GETs (one in-flight + one follow-up).
 *   2. Reconnect: disable network, make mutations from another client, re-enable →
 *      reconnect should fire one GET that reflects all missed changes.
 */
export function useMatchRealtime(
  matchId: string,
  currentRevision: number | undefined,
  devLog?: (source: 'ws' | 'reconnect') => void,
): void {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Current known revision, kept in sync with React Query data (no re-subscribe)
  const revisionRef = useRef(currentRevision);

  // Coalesce state — refs to avoid triggering re-renders
  const isFetchingRef = useRef(false);
  const pendingRefetchRef = useRef(false);
  const latestSeenRevisionRef = useRef(-1);

  // Guard against setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Keep revision ref current without re-running the subscription effect
  useEffect(() => {
    revisionRef.current = currentRevision;
  });

  useEffect(() => {
    if (!token) return;

    // Reset coalesce state whenever matchId / token changes
    isFetchingRef.current = false;
    pendingRefetchRef.current = false;
    latestSeenRevisionRef.current = revisionRef.current ?? -1;

    const socket = getMatchSocket(token);

    async function refetchSnapshot(): Promise<void> {
      if (!mountedRef.current) return;
      isFetchingRef.current = true;
      try {
        await queryClient.refetchQueries({ queryKey: ['match', matchId] });
      } finally {
        if (!mountedRef.current) return;
        isFetchingRef.current = false;
        // One follow-up pass if a newer revision arrived while fetching
        if (
          pendingRefetchRef.current &&
          latestSeenRevisionRef.current > (revisionRef.current ?? -1)
        ) {
          pendingRefetchRef.current = false;
          void refetchSnapshot();
        } else {
          pendingRefetchRef.current = false;
        }
      }
    }

    function onUpdated(payload: MatchUpdatedPayload): void {
      if (payload.matchId !== matchId) return;
      if (payload.revision <= (revisionRef.current ?? -1)) return;

      // Track highest revision seen from the server
      latestSeenRevisionRef.current = Math.max(
        latestSeenRevisionRef.current,
        payload.revision,
      );

      if (isFetchingRef.current) {
        // Coalesce: a fetch is already in flight — schedule one follow-up
        pendingRefetchRef.current = true;
        return;
      }

      devLog?.('ws');
      void refetchSnapshot();
    }

    function onConnect(): void {
      // Re-subscribe (forward lastKnownRevision for future server-side gap detection)
      socket.emit('match.subscribe', {
        matchId,
        lastKnownRevision: revisionRef.current ?? -1,
      });
      // Force one GET to converge after any missed events during disconnection
      devLog?.('reconnect');
      void refetchSnapshot();
    }

    socket.on('connect', onConnect);
    socket.on('match.updated', onUpdated);

    // If already connected, subscribe without an extra GET (data is fresh from mount)
    if (socket.connected) {
      socket.emit('match.subscribe', {
        matchId,
        lastKnownRevision: revisionRef.current ?? -1,
      });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('match.updated', onUpdated);
      socket.emit('match.unsubscribe', { matchId });
    };
  }, [matchId, token, queryClient]);
}
