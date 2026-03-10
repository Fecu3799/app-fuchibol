import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getGroupConversation } from './chatClient';

export function useGroupConversation(groupId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['group-conversation', groupId],
    queryFn: () => getGroupConversation(token!, groupId),
    enabled: !!token && !!groupId,
  });
}
