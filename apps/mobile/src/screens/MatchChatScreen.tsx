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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { randomUUID } from 'expo-crypto';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useMatchConversation } from '../features/chat/useMatchConversation';
import { useMessages } from '../features/chat/useMessages';
import { useSendMessage } from '../features/chat/useSendMessage';
import { useChatRealtime } from '../features/chat/useChatRealtime';
import { useAuth } from '../contexts/AuthContext';
import type { MessageView } from '../types/api';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'MatchChat'>;

export default function MatchChatScreen({ route }: Props) {
  const { matchId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const { data: conv, isLoading: convLoading, error: convError } = useMatchConversation(matchId);
  const {
    data,
    isLoading: msgsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(conv?.id);
  const { mutate: send, isPending: sending } = useSendMessage(conv?.id ?? '');

  useChatRealtime(conv?.id);

  const [input, setInput] = useState('');
  const [sendError, setSendError] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Flatten pages: newest first → reverse for display (oldest at top)
  const messages: MessageView[] = data?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToIndex({ index: 0, animated: false });
    }
  }, []);

  const handleSend = useCallback(() => {
    const body = input.trim();
    if (!body || sending || conv?.isReadOnly) return;
    setSendError('');
    const clientMsgId = randomUUID();
    setInput('');
    send(
      { body, clientMsgId },
      {
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
  }, [input, sending, conv?.isReadOnly, send]);

  if (convLoading || msgsLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (convError || !conv) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>No se pudo cargar el chat.</Text>
      </View>
    );
  }

  function renderItem({ item }: { item: MessageView }) {
    const isMe = item.senderId === user?.id;
    return (
      <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
        {!isMe && (
          <Text style={s.senderName}>{item.senderUsername}</Text>
        )}
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
            <Text style={s.emptyText}>Aún no hay mensajes. ¡Sé el primero en escribir!</Text>
          </View>
        }
      />

      {sendError ? <Text style={s.sendError}>{sendError}</Text> : null}

      <View style={[s.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        {conv.isReadOnly ? (
          <Text style={s.readOnlyText}>Este chat es de solo lectura.</Text>
        ) : (
          <>
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
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#d32f2f', fontSize: 15 },
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
  bubbleMe: {
    backgroundColor: '#1976d2',
    alignSelf: 'flex-end',
  },
  bubbleThem: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    boxShadow: '0px 1px 2px rgba(0,0,0,0.08)',
  },
  senderName: { fontSize: 11, fontWeight: '600', color: '#555', marginBottom: 2 },
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
  readOnlyText: { flex: 1, color: '#888', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  sendError: { color: '#d32f2f', fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },
});
