import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { DirectConversationListItem, GroupConversationListItem, MatchConversationListItem } from '../types/api';
import { useMatchConversations } from '../features/chat/useMatchConversations';
import { useGroupConversations } from '../features/chat/useGroupConversations';
import { useDirectConversations } from '../features/chat/useDirectConversations';
import { useUnreadSummary } from '../features/chat/useUnreadSummary';

type Props = NativeStackScreenProps<RootStackParamList, 'Chats'>;

type ChatTab = 'privados' | 'matches' | 'grupos';

const TABS: { key: ChatTab; label: string }[] = [
  { key: 'privados', label: 'Privados' },
  { key: 'matches', label: 'Matches' },
  { key: 'grupos', label: 'Grupos' },
];

function formatChatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function UnreadDot() {
  return <View style={s.unreadDot} />;
}

function MatchConversationItem({
  item,
  onPress,
}: {
  item: MatchConversationListItem;
  onPress: () => void;
}) {
  const timeStr = item.lastMessage
    ? formatChatTime(item.lastMessage.createdAt)
    : formatChatTime(item.updatedAt);

  return (
    <TouchableOpacity style={s.item} onPress={onPress} activeOpacity={0.7}>
      <View style={s.itemMain}>
        <View style={s.itemHeader}>
          <Text style={[s.itemTitle, item.hasUnread && s.itemTitleUnread]} numberOfLines={1}>
            {item.match.title}
          </Text>
          <View style={s.itemHeaderRight}>
            <Text style={s.itemTime}>{timeStr}</Text>
            {item.hasUnread && <UnreadDot />}
          </View>
        </View>
        <View style={s.itemFooter}>
          {item.lastMessage ? (
            <Text style={[s.itemPreview, item.hasUnread && s.itemPreviewUnread]} numberOfLines={1}>
              <Text style={s.itemSender}>{item.lastMessage.senderUsername}: </Text>
              {item.lastMessage.body}
            </Text>
          ) : (
            <Text style={s.itemNoMessages}>Sin mensajes aún</Text>
          )}
          {item.isReadOnly && (
            <View style={s.readOnlyBadge}>
              <Text style={s.readOnlyText}>Solo lectura</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DirectConversationItem({
  item,
  onPress,
}: {
  item: DirectConversationListItem;
  onPress: () => void;
}) {
  const timeStr = item.lastMessage
    ? formatChatTime(item.lastMessage.createdAt)
    : formatChatTime(item.updatedAt);

  return (
    <TouchableOpacity style={s.item} onPress={onPress} activeOpacity={0.7}>
      <Avatar uri={item.otherUser.avatarUrl} size={44} fallbackText={item.otherUser.username} />
      <View style={[s.itemMain, s.itemMainWithAvatar]}>
        <View style={s.itemHeader}>
          <Text style={[s.itemTitle, item.hasUnread && s.itemTitleUnread]} numberOfLines={1}>
            {item.otherUser.username}
          </Text>
          <View style={s.itemHeaderRight}>
            <Text style={s.itemTime}>{timeStr}</Text>
            {item.hasUnread && <UnreadDot />}
          </View>
        </View>
        <View style={s.itemFooter}>
          {item.lastMessage ? (
            <Text style={[s.itemPreview, item.hasUnread && s.itemPreviewUnread]} numberOfLines={1}>
              {item.lastMessage.body}
            </Text>
          ) : (
            <Text style={s.itemNoMessages}>Sin mensajes aún</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function GroupConversationItem({
  item,
  onPress,
}: {
  item: GroupConversationListItem;
  onPress: () => void;
}) {
  const timeStr = item.lastMessage
    ? formatChatTime(item.lastMessage.createdAt)
    : formatChatTime(item.updatedAt);

  return (
    <TouchableOpacity style={s.item} onPress={onPress} activeOpacity={0.7}>
      <Avatar uri={item.group.avatarUrl} size={44} fallbackText={item.group.name} />
      <View style={[s.itemMain, s.itemMainWithAvatar]}>
        <View style={s.itemHeader}>
          <Text style={[s.itemTitle, item.hasUnread && s.itemTitleUnread]} numberOfLines={1}>
            {item.group.name}
          </Text>
          <View style={s.itemHeaderRight}>
            <Text style={s.itemTime}>{timeStr}</Text>
            {item.hasUnread && <UnreadDot />}
          </View>
        </View>
        <View style={s.itemFooter}>
          {item.lastMessage ? (
            <Text style={[s.itemPreview, item.hasUnread && s.itemPreviewUnread]} numberOfLines={1}>
              <Text style={s.itemSender}>{item.lastMessage.senderUsername}: </Text>
              {item.lastMessage.body}
            </Text>
          ) : (
            <Text style={s.itemNoMessages}>Sin mensajes aún</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatsScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<ChatTab>('privados');
  const { match: matchUnread, group: groupUnread, direct: directUnread } = useUnreadSummary();
  const {
    data: matchConversations,
    isLoading: matchLoading,
    isRefetching: matchRefetching,
    isError: matchError,
    refetch: refetchMatches,
  } = useMatchConversations();
  const {
    data: groupConversations,
    isLoading: groupLoading,
    isRefetching: groupRefetching,
    isError: groupError,
    refetch: refetchGroups,
  } = useGroupConversations();
  const {
    data: directConversations,
    isLoading: directLoading,
    isRefetching: directRefetching,
    isError: directError,
    refetch: refetchDirect,
  } = useDirectConversations();

  function renderMatchesTab() {
    if (matchLoading) {
      return (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      );
    }

    if (matchError) {
      return (
        <View style={s.center}>
          <Text style={s.errorText}>No se pudieron cargar los chats.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => void refetchMatches()}>
            <Text style={s.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!matchConversations || matchConversations.length === 0) {
      return (
        <View style={s.center}>
          <Text style={s.emptyText}>No tenés chats de partidos aún.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={matchConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MatchConversationItem
            item={item}
            onPress={() => navigation.navigate('MatchChat', { matchId: item.match.id })}
          />
        )}
        onRefresh={() => void refetchMatches()}
        refreshing={matchRefetching}
        contentInsetAdjustmentBehavior="automatic"
        ItemSeparatorComponent={() => <View style={s.separator} />}
      />
    );
  }

  function renderPrivadosTab() {
    if (directLoading) {
      return (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      );
    }

    if (directError) {
      return (
        <View style={s.center}>
          <Text style={s.errorText}>No se pudieron cargar los chats.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => void refetchDirect()}>
            <Text style={s.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!directConversations || directConversations.length === 0) {
      return (
        <View style={s.center}>
          <Text style={s.emptyText}>No tenés chats privados aún.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={directConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DirectConversationItem
            item={item}
            onPress={() =>
              navigation.navigate('DirectChat', {
                conversationId: item.id,
                targetUserId: item.otherUser.id,
                otherUsername: item.otherUser.username,
                otherUserAvatarUrl: item.otherUser.avatarUrl,
              })
            }
          />
        )}
        onRefresh={() => void refetchDirect()}
        refreshing={directRefetching}
        contentInsetAdjustmentBehavior="automatic"
        ItemSeparatorComponent={() => <View style={s.separator} />}
      />
    );
  }

  function renderGruposTab() {
    if (groupLoading) {
      return (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      );
    }

    if (groupError) {
      return (
        <View style={s.center}>
          <Text style={s.errorText}>No se pudieron cargar los chats.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => void refetchGroups()}>
            <Text style={s.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!groupConversations || groupConversations.length === 0) {
      return (
        <View style={s.center}>
          <Text style={s.emptyText}>No tenés chats de grupos aún.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={groupConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupConversationItem
            item={item}
            onPress={() =>
              navigation.navigate('GroupChat', {
                groupId: item.group.id,
                groupName: item.group.name,
                groupAvatarUrl: item.group.avatarUrl,
              })
            }
          />
        )}
        onRefresh={() => void refetchGroups()}
        refreshing={groupRefetching}
        contentInsetAdjustmentBehavior="automatic"
        ItemSeparatorComponent={() => <View style={s.separator} />}
      />
    );
  }

  return (
    <View style={s.root}>
      <View style={s.tabBar}>
        {TABS.map((tab) => {
          const tabUnread =
            tab.key === 'privados' ? directUnread :
            tab.key === 'matches' ? matchUnread :
            groupUnread;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabItem, activeTab === tab.key && s.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <View style={s.tabItemInner}>
                <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tabUnread > 0 && (
                  <View style={[s.tabBadge, activeTab === tab.key && s.tabBadgeOnActive]}>
                    <Text style={[s.tabBadgeText, activeTab === tab.key && s.tabBadgeTextOnActive]}>
                      {tabUnread > 99 ? '99+' : String(tabUnread)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.content}>
        {activeTab === 'matches' && renderMatchesTab()}
        {activeTab === 'privados' && renderPrivadosTab()}
        {activeTab === 'grupos' && renderGruposTab()}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  tabItemActive: {
    backgroundColor: '#1976d2',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeOnActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tabBadgeTextOnActive: {
    color: '#d32f2f',
  },
  content: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
  errorText: { fontSize: 15, color: '#d32f2f', textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1976d2',
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  item: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  itemMain: { flex: 1 },
  itemMainWithAvatar: { marginLeft: 12 },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    flex: 1,
    marginRight: 8,
  },
  itemTitleUnread: {
    color: '#000',
    fontWeight: '700',
  },
  itemTime: { fontSize: 12, color: '#999', fontVariant: ['tabular-nums'] },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1976d2',
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemPreview: { fontSize: 14, color: '#555', flex: 1 },
  itemPreviewUnread: { color: '#111', fontWeight: '500' },
  itemSender: { fontWeight: '500', color: '#444' },
  itemNoMessages: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
  readOnlyBadge: {
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  readOnlyText: { fontSize: 11, color: '#888' },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f0f0f0',
    marginLeft: 16,
  },
});
