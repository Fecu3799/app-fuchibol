import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../lib/api';
import { getMatch, postMatchAction } from './matchesClient';
import { randomUUID } from 'expo-crypto';

export function formatLockError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Connection error. Please try again.';
  const code = err.code;
  if (code === 'ALREADY_LOCKED') return 'Match is already locked';
  if (code === 'ALREADY_UNLOCKED') return 'Match is already unlocked';
  if (code === 'REVISION_CONFLICT') return 'Match was updated, please try again';
  if (err.status === 403) return 'No permission';
  if (err.status === 404) return 'Match not found';
  if (err.status === 409) return 'Conflict — please refresh and try again';
  return err.body.detail ?? err.body.message ?? 'Something went wrong';
}

export function useLockMatch(matchId: string) {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ revision }: { revision: number }) => {
      const key = randomUUID();
      try {
        return await postMatchAction(token!, matchId, 'lock', revision, key);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          throw err;
        }
        if (err instanceof ApiError && err.code === 'REVISION_CONFLICT') {
          const fresh = await getMatch(token!, matchId);
          const retryKey = randomUUID();
          return await postMatchAction(token!, matchId, 'lock', fresh.match.revision, retryKey);
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['match', matchId], { match: data });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useUnlockMatch(matchId: string) {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ revision }: { revision: number }) => {
      const key = randomUUID();
      try {
        return await postMatchAction(token!, matchId, 'unlock', revision, key);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          throw err;
        }
        if (err instanceof ApiError && err.code === 'REVISION_CONFLICT') {
          const fresh = await getMatch(token!, matchId);
          const retryKey = randomUUID();
          return await postMatchAction(token!, matchId, 'unlock', fresh.match.revision, retryKey);
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['match', matchId], { match: data });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}
