import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getChatSocket } from '../../lib/socket';
import { markConversationRead } from './chatClient';
import type {
  DirectConversationListItem,
  GroupConversationListItem,
  MatchConversationListItem,
  MessageView,
} from '../../types/api';

interface NewMessagePayload {
  conversationId: string;
  message: MessageView;
}

type ListItem =
  | MatchConversationListItem
  | GroupConversationListItem
  | DirectConversationListItem;

function updateListLastMessage<T extends ListItem>(
  old: T[] | undefined,
  conversationId: string,
  msg: MessageView,
): T[] | undefined {
  if (!old) return old;
  let found = false;
  const updated = old.map((item) => {
    if (item.id !== conversationId) return item;
    found = true;
    return {
      ...item,
      lastMessage: {
        id: msg.id,
        body: msg.body,
        senderUsername: msg.senderUsername,
        createdAt: msg.createdAt,
      },
      // User is actively viewing → clear unread indicator in the list cache
      hasUnread: false,
    };
  });
  if (!found) return old;
  // Re-sort by lastMessage.createdAt descending (mirrors backend sort)
  return (updated as T[]).sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? a.updatedAt;
    const bTime = b.lastMessage?.createdAt ?? b.updatedAt;
    return bTime < aTime ? -1 : bTime > aTime ? 1 : 0;
  });
}

/**
 * Module-level ref tracking the currently open conversation.
 * Read by useChatListRealtime to avoid setting hasUnread=true when user is viewing.
 */
export const activeViewedConversationId = { current: null as string | null };

/**
 * Subscribes to realtime chat messages via Socket.IO /chat namespace.
 * On new message:
 *   - Prepends to the messages cache (deduped by id).
 *   - Updates lastMessage in all conversation list caches (only one will match).
 *   - Clears hasUnread in cache (user is actively viewing).
 * On subscribe/reconnect: marks conversation as read.
 */
export function useChatRealtime(conversationId: string | undefined): void {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Fire-and-forget mark-as-read: updates DB lastReadAt and clears hasUnread in list caches
  const markRead = useCallback(
    (convId: string) => {
      if (!token) return;
      markConversationRead(token, convId)
        .then(() => {
          // Optimistically clear hasUnread in all list caches
          const clearUnread = <T extends ListItem>(old: T[] | undefined): T[] | undefined => {
            if (!old) return old;
            return old.map((item) =>
              item.id === convId ? { ...item, hasUnread: false } : item,
            );
          };
          queryClient.setQueryData(
            ['match-conversations'],
            (old: MatchConversationListItem[] | undefined) => clearUnread(old),
          );
          queryClient.setQueryData(
            ['group-conversations'],
            (old: GroupConversationListItem[] | undefined) => clearUnread(old),
          );
          queryClient.setQueryData(
            ['direct-conversations'],
            (old: DirectConversationListItem[] | undefined) => clearUnread(old),
          );
          void queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        })
        .catch(() => {
          // Non-critical: ignore failures — hasUnread will be correct on next list refetch
        });
    },
    // queryClient is a stable singleton — intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  useEffect(() => {
    if (!token || !conversationId) return;
    // Narrow to string for closures below (guard above guarantees non-undefined)
    const convId: string = conversationId;

    // Track the active conversation so useChatListRealtime knows not to set hasUnread=true
    activeViewedConversationId.current = convId;

    const socket = getChatSocket(token);

    function onMessage(payload: NewMessagePayload): void {
      if (payload.conversationId !== convId) return;

      // Update messages cache (deduped by id)
      queryClient.setQueryData(
        ['messages', convId],
        (old: { pages: { items: MessageView[]; hasMore: boolean; nextCursor: string | null }[]; pageParams: unknown[] } | undefined) => {
          if (!old) {
            // Cache not populated yet (message arrived during initial load).
            return {
              pages: [{ items: [payload.message], hasMore: false, nextCursor: null }],
              pageParams: [undefined],
            };
          }
          const [firstPage, ...rest] = old.pages;
          if (firstPage?.items.some((m) => m.id === payload.message.id)) return old;
          return {
            ...old,
            pages: [
              {
                items: [payload.message, ...(firstPage?.items ?? [])],
                hasMore: firstPage?.hasMore ?? false,
                nextCursor: firstPage?.nextCursor ?? null,
              },
              ...rest,
            ],
          };
        },
      );

      // Update conversation list caches (zero-network, only one list will have this id)
      queryClient.setQueryData(
        ['match-conversations'],
        (old: MatchConversationListItem[] | undefined) =>
          updateListLastMessage(old, convId, payload.message),
      );
      queryClient.setQueryData(
        ['group-conversations'],
        (old: GroupConversationListItem[] | undefined) =>
          updateListLastMessage(old, convId, payload.message),
      );
      queryClient.setQueryData(
        ['direct-conversations'],
        (old: DirectConversationListItem[] | undefined) =>
          updateListLastMessage(old, convId, payload.message),
      );

      // Mark as read in DB since user is actively viewing
      markRead(convId);
    }

    function onConnect(): void {
      socket.emit('chat.subscribe', { conversationId: convId });
      // Mark as read whenever we (re)connect to the conversation
      markRead(convId);
    }

    socket.on('connect', onConnect);
    socket.on('message.new', onMessage);

    if (socket.connected) {
      socket.emit('chat.subscribe', { conversationId: convId });
      markRead(convId);
    }

    return () => {
      if (activeViewedConversationId.current === convId) {
        activeViewedConversationId.current = null;
      }
      socket.off('connect', onConnect);
      socket.off('message.new', onMessage);
      socket.emit('chat.unsubscribe', { conversationId: convId });
    };
  // queryClient is a stable singleton from React Query — omitting from deps intentionally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, token, markRead]);
}
