import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getMatchSocket } from '../../lib/socket';

interface MatchUpdatedPayload {
  matchId: string;
  revision: number;
}

export function useMatchRealtime(
  matchId: string,
  currentRevision: number | undefined,
): void {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const revisionRef = useRef(currentRevision);

  // Keep ref in sync without triggering re-subscribe
  useEffect(() => {
    revisionRef.current = currentRevision;
  });

  useEffect(() => {
    if (!token) return;

    const socket = getMatchSocket(token);

    function onUpdated(payload: MatchUpdatedPayload): void {
      if (
        payload.matchId === matchId &&
        payload.revision > (revisionRef.current ?? -1)
      ) {
        void queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      }
    }

    socket.emit('match.subscribe', { matchId });
    socket.on('match.updated', onUpdated);

    return () => {
      socket.off('match.updated', onUpdated);
      socket.emit('match.unsubscribe', { matchId });
    };
  }, [matchId, token, queryClient]);
}
