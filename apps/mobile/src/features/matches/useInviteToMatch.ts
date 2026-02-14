import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../lib/api';
import { inviteToMatch, getMatch } from './matchesClient';

export function formatInviteError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Connection error. Please try again.';
  const code = err.code;
  if (code === 'USER_NOT_FOUND') return 'User not found';
  if (code === 'SELF_INVITE') return 'You cannot invite yourself';
  if (code === 'ALREADY_PARTICIPANT') return 'User is already a participant';
  if (code === 'MATCH_LOCKED') return 'Match is locked';
  if (code === 'REVISION_CONFLICT') return 'Match was updated, please try again';
  if (err.status === 422) {
    const msg = err.body.detail ?? err.body.message;
    return typeof msg === 'string' ? msg : 'Validation error';
  }
  return err.body.detail ?? err.body.message ?? 'Something went wrong';
}

export function useInviteToMatch(matchId: string) {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ identifier, revision }: { identifier: string; revision: number }) => {
      const key = randomUUID();
      try {
        return await inviteToMatch(token!, matchId, identifier, revision, key);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          throw err;
        }
        if (err instanceof ApiError && err.code === 'REVISION_CONFLICT') {
          const fresh = await getMatch(token!, matchId);
          const retryKey = randomUUID();
          return await inviteToMatch(token!, matchId, identifier, fresh.match.revision, retryKey);
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
