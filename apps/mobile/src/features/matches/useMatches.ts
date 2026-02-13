import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getMatches } from './matchesClient';

export function useMatches(page = 1) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['matches', page],
    queryFn: () => getMatches(token!, { page }),
    enabled: !!token,
  });
}
