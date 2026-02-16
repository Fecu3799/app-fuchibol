import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getMatches } from './matchesClient';

export function useMatchHistory(page = 1) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['matches', 'history', page],
    queryFn: () => getMatches(token!, { page, view: 'history' }),
    enabled: !!token,
    placeholderData: keepPreviousData,
  });
}
