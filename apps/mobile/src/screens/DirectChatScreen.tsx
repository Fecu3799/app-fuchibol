import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { randomUUID } from 'expo-crypto';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useMessages } from '../features/chat/useMessages';
import { useSendMessage } from '../features/chat/useSendMessage';
import { useSendFirstDirectMessage } from '../features/chat/useSendFirstDirectMessage';
import { useChatRealtime } from '../features/chat/useChatRealtime';
import { findDirectConversation } from '../features/chat/chatClient';
import { useAuth } from '../contexts/AuthContext';
import type { MessageView } from '../types/api';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'DirectChat'>;

export default function DirectChatScreen({ route }: Props) {
  const { otherUsername } = route.params;
  const initialConversationId = route.params.conversationId;
  const targetUserId = route.params.targetUserId;

  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();

  // liveConversationId: undefined = resolving or draft, string = live (connected to a real conv)
  const [liveConversationId, setLiveConversationId] = useState<string | undefined>(
    initialConversationId,
  );
  // resolving: true while checking if a conversation already exists (only when entering from profile)
  const [resolving, setResolving] = useState(
    !initialConversationId && !!targetUserId,
  );

  // On mount: if entered from profile (no conversationId), check if conversation already exists.
  // If found → live mode with existing messages. If not → draft mode.
  useEffect(() => {
    if (initialConversationId || !targetUserId || !token) return;
    findDirectConversation(token, targetUserId)
      .then((convId) => {
        if (convId) setLiveConversationId(convId);
      })
      .catch(() => {
        // silent fail — stay in draft mode; user can still send a first message
      })
      .finally(() => setResolving(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  const isDraft = !resolving && !liveConversationId;

  const {
    data,
    isLoading: msgsLoading,
    isError: msgsError,
    refetch: refetchMsgs,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(liveConversationId);

  const { mutate: sendExisting, isPending: sendingExisting } = useSendMessage(
    liveConversationId ?? '',
  );
  const { mutate: sendFirst, isPending: sendingFirst } = useSendFirstDirectMessage();

  useChatRealtime(liveConversationId);

  const [input, setInput] = useState('');
  const [sendError, setSendError] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const messages: MessageView[] = data?.pages.flatMap((p) => p.items) ?? [];
  const sending = sendingExisting || sendingFirst;

  const handleSend = useCallback(() => {
    const body = input.trim();
    if (!body || sending) return;
    setSendError('');
    const clientMsgId = randomUUID();
    setInput('');

    if (isDraft && targetUserId) {
      // First message — creates the conversation atomically
      sendFirst(
        { targetUserId, body, clientMsgId },
        {
          onSuccess: (result) => {
            setLiveConversationId(result.conversationId);
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          },
          onError: (err) => {
            setSendError(
              err instanceof ApiError
                ? (err.body.detail ?? err.body.message ?? 'Error al enviar')
                : 'Error de conexión',
            );
            setInput(body);
          },
        },
      );
    } else if (liveConversationId) {
      sendExisting(
        { body, clientMsgId },
        {
          onSuccess: () => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          },
          onError: (err) => {
            setSendError(
              err instanceof ApiError
                ? (err.body.detail ?? err.body.message ?? 'Error al enviar')
                : 'Error de conexión',
            );
            setInput(body);
          },
        },
      );
    }
  }, [input, sending, isDraft, targetUserId, liveConversationId, sendFirst, sendExisting]);

  // Resolving (checking if conv exists on mount from profile)
  if (resolving) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // Loading existing messages (live mode, first load)
  if (!isDraft && msgsLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isDraft && msgsError) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>No se pudo cargar el chat.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => void refetchMsgs()}>
          <Text style={s.retryBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderItem({ item }: { item: MessageView }) {
    const isMe = item.senderId === user?.id;
    return (
      <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
        <Text style={[s.bodyText, isMe && s.bodyTextMe]}>{item.body}</Text>
        <Text style={[s.timestamp, isMe && s.timestampMe]}>
          {new Date(item.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        inverted
        maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 10 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 8 }} /> : null
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>
              {isDraft
                ? `Iniciá una conversación con @${otherUsername}`
                : 'Aún no hay mensajes. ¡Sé el primero en escribir!'}
            </Text>
          </View>
        }
      />

      {sendError ? <Text style={s.sendError}>{sendError}</Text> : null}

      <View style={[s.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribe un mensaje…"
          placeholderTextColor="#aaa"
          multiline
          maxLength={2000}
          autoCorrect
          autoCapitalize="sentences"
          returnKeyType="default"
        />
        <Pressable
          style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.sendBtnText}>Enviar</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#d32f2f', fontSize: 15, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1976d2',
  },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  emptyText: { color: '#999', fontSize: 14, textAlign: 'center' },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
    borderCurve: 'continuous',
  },
  bubbleMe: { backgroundColor: '#1976d2', alignSelf: 'flex-end' },
  bubbleThem: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    boxShadow: '0px 1px 2px rgba(0,0,0,0.08)',
  },
  bodyText: { fontSize: 15, color: '#1a1a1a' },
  bodyTextMe: { color: '#fff' },
  timestamp: { fontSize: 10, color: '#888', marginTop: 3, alignSelf: 'flex-end' },
  timestampMe: { color: 'rgba(255,255,255,0.7)' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
    maxHeight: 120,
    backgroundColor: '#fafafa',
    borderCurve: 'continuous',
  },
  sendBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sendError: { color: '#d32f2f', fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },
});
