import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { listMessages } from './chatClient';

export function useMessages(conversationId: string | undefined) {
  const { token } = useAuth();
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      listMessages(token!, conversationId!, {
        limit: 30,
        before: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    enabled: !!token && !!conversationId,
  });
}
