import { buildUrl, fetchJson } from '../../lib/api';
import type { ConversationInfo, ListMessagesResponse, MessageView } from '../../types/api';

export function getMatchConversation(
  token: string,
  matchId: string,
): Promise<ConversationInfo> {
  return fetchJson<ConversationInfo>(
    buildUrl(`/api/v1/matches/${matchId}/conversation`),
    { headers: { Authorization: `Bearer ${token}` } },
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
