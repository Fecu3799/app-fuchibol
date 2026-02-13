import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../lib/api';
import { getMatch, postMatchAction } from './matchesClient';

export function formatActionError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Connection error. Please try again.';
  const code = err.code;
  if (code === 'MATCH_LOCKED') return 'Match is locked';
  if (code === 'REVISION_CONFLICT') return 'Match was updated, please try again';
  if (code === 'CAPACITY_BELOW_CONFIRMED') return 'Cannot reduce capacity below confirmed count';
  if (err.status === 422) {
    const msg = err.body.detail ?? err.body.message;
    return typeof msg === 'string' ? msg : 'Validation error';
  }
  return err.body.detail ?? err.body.message ?? 'Something went wrong';
}

export function useMatchAction(matchId: string) {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, revision }: { action: string; revision: number }) => {
      const key = randomUUID();
      try {
        return await postMatchAction(token!, matchId, action, revision, key);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          throw err;
        }
        if (err instanceof ApiError && err.code === 'REVISION_CONFLICT') {
          const fresh = await getMatch(token!, matchId);
          const retryKey = randomUUID();
          return await postMatchAction(token!, matchId, action, fresh.match.revision, retryKey);
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['match', matchId], data);
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}
