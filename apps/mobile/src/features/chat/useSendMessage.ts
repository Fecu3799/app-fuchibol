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
          const alreadyExists = firstPage?.items.some((m) => m.id === message.id);
          if (alreadyExists) return old;
          return {
            ...old,
            pages: [
              { ...firstPage, items: [message, ...(firstPage?.items ?? [])] },
              ...rest,
            ],
          };
        },
      );
    },
  });
}
