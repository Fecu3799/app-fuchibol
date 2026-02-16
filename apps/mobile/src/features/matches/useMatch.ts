import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getMatch } from './matchesClient';

export function useMatch(matchId: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatch(token!, matchId),
    enabled: !!token,
    select: (data) => data.match,
    placeholderData: keepPreviousData,
  });
}
