import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getMatchConversation } from './chatClient';

export function useMatchConversation(matchId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['match-conversation', matchId],
    queryFn: () => getMatchConversation(token!, matchId),
    enabled: !!token,
  });
}
