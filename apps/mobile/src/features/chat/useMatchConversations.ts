import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { listMatchConversations } from './chatClient';

export function useMatchConversations() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['match-conversations'],
    queryFn: () => listMatchConversations(token!),
    enabled: !!token,
  });
}
