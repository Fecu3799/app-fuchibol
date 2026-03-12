import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getUnreadConversationCount } from './chatClient';

export function useUnreadCount() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['unread-count'],
    queryFn: () => getUnreadConversationCount(token!),
    enabled: !!token,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
