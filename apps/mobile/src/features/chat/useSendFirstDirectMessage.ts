import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { sendFirstDirectMessage } from './chatClient';
import type { MessageView } from '../../types/api';

export interface SendFirstDirectMessageResult {
  conversationId: string;
  message: MessageView;
}

export function useSendFirstDirectMessage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { targetUserId: string; body: string; clientMsgId: string }) =>
      sendFirstDirectMessage(token!, payload),
    onSuccess: ({ conversationId, message }: SendFirstDirectMessageResult) => {
      // Seed the messages cache so the live-mode screen shows the first message immediately
      // without a network round-trip.
      queryClient.setQueryData(
        ['messages', conversationId],
        {
          pages: [{ items: [message], hasMore: false, nextCursor: null }],
          pageParams: [undefined],
        },
      );
      // Refresh direct-conversations so the new conversation appears in the list
      // and badges update for the sender.
      void queryClient.invalidateQueries({
        queryKey: ['direct-conversations'],
        refetchType: 'all',
      });
    },
  });
}
