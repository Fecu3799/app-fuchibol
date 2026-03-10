import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { listDirectConversations } from './chatClient';

export function useDirectConversations() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['direct-conversations'],
    queryFn: () => listDirectConversations(token!),
    enabled: !!token,
  });
}
