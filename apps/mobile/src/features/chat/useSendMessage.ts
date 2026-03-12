import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { sendMessage } from './chatClient';
import type { MessageView } from '../../types/api';

export function useSendMessage(conversationId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { body: string; clientMsgId: string }) =>
      sendMessage(token!, conversationId, payload),
    onSuccess: (message: MessageView) => {
      // Upsert into the first page — dedup by id in case WS beat the HTTP response
      queryClient.setQueryData(
        ['messages', conversationId],
        (old: { pages: { items: MessageView[]; hasMore: boolean; nextCursor: string | null }[] } | undefined) => {
          if (!old) return old;
          const [firstPage, ...rest] = old.pages;
          if (firstPage?.items.some((m) => m.id === message.id)) return old;
          return {
            ...old,
            pages: [
              { ...firstPage, items: [message, ...(firstPage?.items ?? [])] },
              ...rest,
            ],
          };
        },
      );

      // Invalidate conversation lists so they reflect the new last message.
      // The sender also receives their own message via WS (useChatRealtime handles
      // the optimistic cache update), but invalidation is the safety net when WS
      // is temporarily disconnected.
      void queryClient.invalidateQueries({ queryKey: ['match-conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['direct-conversations'] });
    },
  });
}
