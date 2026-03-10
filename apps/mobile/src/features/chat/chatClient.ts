import { buildUrl, fetchJson } from '../../lib/api';
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
