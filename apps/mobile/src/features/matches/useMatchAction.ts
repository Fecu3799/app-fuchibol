import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../lib/api';
import { getMatch, postMatchAction } from './matchesClient';

export function useMatchAction(matchId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, revision }: { action: string; revision: number }) => {
      const key = randomUUID();
      try {
        return await postMatchAction(token!, matchId, action, revision, key);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && err.body.message === 'REVISION_CONFLICT') {
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
