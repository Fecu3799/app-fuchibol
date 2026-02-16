import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getGroups } from './groupsClient';

export function useGroups() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['groups'],
    queryFn: () => getGroups(token!),
    enabled: !!token,
  });
}
