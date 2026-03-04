import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getInviteCandidates } from './matchesClient';

export function useInviteCandidates(
  matchId: string,
  groupId: string | null,
) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['invite-candidates', matchId, groupId],
    queryFn: () => getInviteCandidates(token!, matchId, groupId!),
    enabled: !!token && !!groupId,
    staleTime: 0,
  });
}
