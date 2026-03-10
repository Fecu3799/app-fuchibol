import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { listGroupConversations } from './chatClient';

export function useGroupConversations() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['group-conversations'],
    queryFn: () => listGroupConversations(token!),
    enabled: !!token,
  });
}
