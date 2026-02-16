import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../lib/api';
import { inviteToMatch, getMatch } from './matchesClient';

interface BatchInviteInput {
  usernames: string[];
  revision: number;
}

interface BatchInviteResult {
  total: number;
  successful: number;
  failed: number;
  errors: { username: string; error: string }[];
}

export function useBatchInviteFromGroup(matchId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ usernames, revision }: BatchInviteInput): Promise<BatchInviteResult> => {
      let currentRevision = revision;
      const errors: { username: string; error: string }[] = [];
      let successful = 0;

      for (const username of usernames) {
        try {
          const result = await inviteToMatch(
            token!,
            matchId,
            username,
            currentRevision,
            randomUUID(),
          );
          currentRevision = result.revision;
          successful++;
        } catch (err) {
          if (err instanceof ApiError && err.code === 'REVISION_CONFLICT') {
            try {
              const fresh = await getMatch(token!, matchId);
              currentRevision = fresh.match.revision;
              const result = await inviteToMatch(
                token!,
                matchId,
                username,
                currentRevision,
                randomUUID(),
              );
              currentRevision = result.revision;
              successful++;
            } catch (retryErr) {
              const msg =
                retryErr instanceof ApiError
                  ? retryErr.code ?? retryErr.message
                  : 'Unknown error';
              errors.push({ username, error: msg });
            }
          } else {
            const msg =
              err instanceof ApiError
                ? err.code ?? err.message
                : 'Unknown error';
            errors.push({ username, error: msg });
          }
        }
      }

      return {
        total: usernames.length,
        successful,
        failed: errors.length,
        errors,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}
