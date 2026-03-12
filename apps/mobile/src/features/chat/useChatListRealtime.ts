import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getChatSocket } from '../../lib/socket';
import { listMatchConversations, listGroupConversations, listDirectConversations } from './chatClient';
import { activeViewedConversationId } from './useChatRealtime';
import type {
  DirectConversationListItem,
  GroupConversationListItem,
  MatchConversationListItem,
} from '../../types/api';

interface ConversationUpdatedPayload {
  conversationId: string;
  type: string;
  lastMessage: {
    id: string;
    body: string;
    senderUsername: string;
    createdAt: string;
    senderId: string;
  };
}

type ListItem =
  | MatchConversationListItem
  | GroupConversationListItem
  | DirectConversationListItem;

/**
 * Returns updated list sorted by lastMessage.createdAt desc.
 * Returns null if the conversation was not found (cache missing or new conversation) —
 * caller should invalidate the query to trigger a fresh fetch.
 */
function applyConversationUpdate<T extends ListItem>(
  old: T[] | undefined,
  convId: string,
  lastMessage: ConversationUpdatedPayload['lastMessage'],
  hasUnread: boolean,
): T[] | null {
  if (!old) return null;
  let found = false;
  const updated = old.map((item) => {
    if (item.id !== convId) return item;
    found = true;
    return {
      ...item,
      lastMessage: {
        id: lastMessage.id,
        body: lastMessage.body,
        senderUsername: lastMessage.senderUsername,
        createdAt: lastMessage.createdAt,
      },
      hasUnread,
    };
  });
  if (!found) return null;
  return (updated as T[]).sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? a.updatedAt;
    const bTime = b.lastMessage?.createdAt ?? b.updatedAt;
    return bTime < aTime ? -1 : bTime > aTime ? 1 : 0;
  });
}

/**
 * Global realtime listener for conversation list updates.
 * Listens to `chat.conversation.updated` events emitted to the user's personal
 * `user:{userId}` room (auto-joined by backend on WS connect).
 *
 * Also prefetches the 3 conversation lists on mount so that badges work
 * immediately without waiting for ChatsScreen to be visited.
 *
 * Mount this once at app level (e.g. via ChatManager in AppNavigator).
 */
export function useChatListRealtime(): void {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  // Prefetch conversation lists on mount so unread counts are available immediately
  useEffect(() => {
    if (!token) return;
    void queryClient.prefetchQuery({
      queryKey: ['match-conversations'],
      queryFn: () => listMatchConversations(token),
      staleTime: 30_000,
    });
    void queryClient.prefetchQuery({
      queryKey: ['group-conversations'],
      queryFn: () => listGroupConversations(token),
      staleTime: 30_000,
    });
    void queryClient.prefetchQuery({
      queryKey: ['direct-conversations'],
      queryFn: () => listDirectConversations(token),
      staleTime: 30_000,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Listen for conversation list updates on the user's personal room
  useEffect(() => {
    if (!token || !user?.id) return;
    const userId = user.id;
    const socket = getChatSocket(token);

    function onConversationUpdated(payload: ConversationUpdatedPayload): void {
      const { conversationId: convId, type, lastMessage } = payload;

      // If user is actively viewing this conversation (useChatRealtime is handling it),
      // clear unread; otherwise set unread based on who sent the message.
      const isViewing = activeViewedConversationId.current === convId;
      const hasUnread = !isViewing && lastMessage.senderId !== userId;

      if (type === 'MATCH') {
        let found = false;
        queryClient.setQueryData(
          ['match-conversations'],
          (old: MatchConversationListItem[] | undefined) => {
            const result = applyConversationUpdate(old, convId, lastMessage, hasUnread);
            if (result === null) return old;
            found = true;
            return result;
          },
        );
        if (!found) {
          void queryClient.invalidateQueries({ queryKey: ['match-conversations'], refetchType: 'all' });
        }
      } else if (type === 'GROUP') {
        let found = false;
        queryClient.setQueryData(
          ['group-conversations'],
          (old: GroupConversationListItem[] | undefined) => {
            const result = applyConversationUpdate(old, convId, lastMessage, hasUnread);
            if (result === null) return old;
            found = true;
            return result;
          },
        );
        if (!found) {
          void queryClient.invalidateQueries({ queryKey: ['group-conversations'], refetchType: 'all' });
        }
      } else if (type === 'DIRECT') {
        let found = false;
        queryClient.setQueryData(
          ['direct-conversations'],
          (old: DirectConversationListItem[] | undefined) => {
            const result = applyConversationUpdate(old, convId, lastMessage, hasUnread);
            if (result === null) return old;
            found = true;
            return result;
          },
        );
        if (!found) {
          void queryClient.invalidateQueries({ queryKey: ['direct-conversations'], refetchType: 'all' });
        }
      }
    }

    socket.on('chat.conversation.updated', onConversationUpdated);

    return () => {
      socket.off('chat.conversation.updated', onConversationUpdated);
    };
  // queryClient is a stable singleton — intentionally excluded from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);
}
