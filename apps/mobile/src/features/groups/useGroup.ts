import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getGroup } from './groupsClient';

export function useGroup(groupId: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(token!, groupId),
    enabled: !!token && !!groupId,
  });
}
