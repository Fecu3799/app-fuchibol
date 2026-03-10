import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getChatSocket } from '../../lib/socket';
import type { MessageView } from '../../types/api';

interface NewMessagePayload {
  conversationId: string;
  message: MessageView;
}

/**
 * Subscribes to realtime chat messages via Socket.IO /chat namespace.
 * On new message: prepends to the messages cache (deduped by id).
 * On reconnect: re-subscribes to the conversation room.
 */
export function useChatRealtime(conversationId: string | undefined): void {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!token || !conversationId) return;

    const socket = getChatSocket(token);

    function onMessage(payload: NewMessagePayload): void {
      if (payload.conversationId !== conversationId) return;
      if (!mountedRef.current) return;

      queryClient.setQueryData(
        ['messages', conversationId],
        (old: { pages: { items: MessageView[]; hasMore: boolean; nextCursor: string | null }[] } | undefined) => {
          if (!old) return old;
          const [firstPage, ...rest] = old.pages;
          // Dedupe by id (sender already gets the message from useSendMessage onSuccess)
          const alreadyExists = firstPage?.items.some((m) => m.id === payload.message.id);
          if (alreadyExists) return old;
          return {
            ...old,
            pages: [
              { ...firstPage, items: [payload.message, ...(firstPage?.items ?? [])] },
              ...rest,
            ],
          };
        },
      );
    }

    function onConnect(): void {
      socket.emit('chat.subscribe', { conversationId });
    }

    socket.on('connect', onConnect);
    socket.on('message.new', onMessage);

    if (socket.connected) {
      socket.emit('chat.subscribe', { conversationId });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('message.new', onMessage);
      socket.emit('chat.unsubscribe', { conversationId });
    };
  // queryClient is a stable singleton from React Query — omitting from deps intentionally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, token]);
}
