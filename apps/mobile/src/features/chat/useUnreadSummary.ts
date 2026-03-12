import { useMatchConversations } from './useMatchConversations';
import { useGroupConversations } from './useGroupConversations';
import { useDirectConversations } from './useDirectConversations';
import { useUnreadCount } from './useUnreadCount';

export interface UnreadSummary {
  total: number;
  match: number;
  group: number;
  direct: number;
}

/**
 * Reactive unread summary derived from the 3 conversation list caches.
 * Falls back to the backend unread-count endpoint while the lists are loading.
 *
 * Updates automatically whenever any list cache changes (via useChatListRealtime
 * or useChatRealtime), with no polling.
 */
export function useUnreadSummary(): UnreadSummary {
  const { data: matchConvs } = useMatchConversations();
  const { data: groupConvs } = useGroupConversations();
  const { data: directConvs } = useDirectConversations();

  const listsLoaded =
    matchConvs !== undefined ||
    groupConvs !== undefined ||
    directConvs !== undefined;

  // Fallback to backend count while lists are loading (covers initial render)
  const { data: backendCount } = useUnreadCount();

  const match = matchConvs?.filter((c) => c.hasUnread).length ?? 0;
  const group = groupConvs?.filter((c) => c.hasUnread).length ?? 0;
  const direct = directConvs?.filter((c) => c.hasUnread).length ?? 0;

  if (!listsLoaded) {
    return { total: backendCount?.total ?? 0, match: 0, group: 0, direct: 0 };
  }

  return { total: match + group + direct, match, group, direct };
}
