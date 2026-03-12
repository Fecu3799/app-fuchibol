import { ApiError, buildUrl, fetchJson } from '../../lib/api';
import type {
  ConversationInfo,
  DirectConversationListItem,
  GroupConversationListItem,
  ListMessagesResponse,
  MatchConversationListItem,
  MessageView,
} from '../../types/api';

export function listMatchConversations(
  token: string,
): Promise<MatchConversationListItem[]> {
  return fetchJson<MatchConversationListItem[]>(
    buildUrl('/api/v1/conversations'),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function listGroupConversations(
  token: string,
): Promise<GroupConversationListItem[]> {
  return fetchJson<GroupConversationListItem[]>(
    buildUrl('/api/v1/conversations/groups'),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function getGroupConversation(
  token: string,
  groupId: string,
): Promise<ConversationInfo> {
  return fetchJson<ConversationInfo>(
    buildUrl(`/api/v1/groups/${groupId}/conversation`),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function getMatchConversation(
  token: string,
  matchId: string,
): Promise<ConversationInfo> {
  return fetchJson<ConversationInfo>(
    buildUrl(`/api/v1/matches/${matchId}/conversation`),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function listDirectConversations(
  token: string,
): Promise<DirectConversationListItem[]> {
  return fetchJson<DirectConversationListItem[]>(
    buildUrl('/api/v1/conversations/direct'),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function getOrCreateDirectConversation(
  token: string,
  targetUserId: string,
): Promise<ConversationInfo> {
  return fetchJson<ConversationInfo>(
    buildUrl('/api/v1/conversations/direct'),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetUserId }),
    },
  );
}

/**
 * Looks up an existing direct conversation without creating one.
 * Returns the conversationId string if found, null if it doesn't exist yet.
 */
export async function findDirectConversation(
  token: string,
  targetUserId: string,
): Promise<string | null> {
  try {
    const result = await fetchJson<{ id: string }>(
      buildUrl('/api/v1/conversations/direct/find', { targetUserId }),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return result.id;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Atomically creates a direct conversation (if it doesn't exist) and sends
 * the first message in it. Idempotent via clientMsgId.
 */
export function sendFirstDirectMessage(
  token: string,
  payload: { targetUserId: string; body: string; clientMsgId: string },
): Promise<{ conversationId: string; message: MessageView }> {
  return fetchJson<{ conversationId: string; message: MessageView }>(
    buildUrl('/api/v1/conversations/direct/first-message'),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
}

export function listMessages(
  token: string,
  conversationId: string,
  params?: { limit?: number; before?: string },
): Promise<ListMessagesResponse> {
  return fetchJson<ListMessagesResponse>(
    buildUrl(`/api/v1/conversations/${conversationId}/messages`, params as Record<string, string | number | undefined>),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function sendMessage(
  token: string,
  conversationId: string,
  payload: { body: string; clientMsgId: string },
): Promise<MessageView> {
  return fetchJson<MessageView>(
    buildUrl(`/api/v1/conversations/${conversationId}/messages`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
}

export function getUnreadConversationCount(
  token: string,
): Promise<{ total: number }> {
  return fetchJson<{ total: number }>(
    buildUrl('/api/v1/conversations/unread-count'),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function markConversationRead(
  token: string,
  conversationId: string,
): Promise<void> {
  return fetchJson<void>(
    buildUrl(`/api/v1/conversations/${conversationId}/read`),
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}
