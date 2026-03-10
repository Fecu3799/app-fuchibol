import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { GroupSummary } from '../types/api';
import { useGroups } from '../features/groups/useGroups';
import { useAuth } from '../contexts/AuthContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function GroupCard({
  group,
  isOwner,
  onPress,
}: {
  group: GroupSummary;
  isOwner: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>
          {group.name}
        </Text>
        {isOwner && (
          <View style={styles.ownerBadge}>
            <Text style={styles.ownerBadgeText}>Owner</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardMembers}>
        {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
      </Text>
    </Pressable>
  );
}

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useGroups();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerBtn} />
          <Text style={styles.headerTitle}>Groups</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerBtn} />
          <Text style={styles.headerTitle}>Groups</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load groups</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const owned = data?.owned ?? [];
  const memberOf = data?.memberOf ?? [];
  const isEmpty = owned.length === 0 && memberOf.length === 0;

  const sections: { title: string; data: GroupSummary[]; isOwnerSection: boolean }[] = [];
  if (owned.length > 0) sections.push({ title: 'My Groups', data: owned, isOwnerSection: true });
  if (memberOf.length > 0) sections.push({ title: 'Member Of', data: memberOf, isOwnerSection: false });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.headerBtn}
          onPress={() => navigation.navigate('CreateGroup')}
          hitSlop={8}
        >
          <Text style={styles.headerBtnPlus}>+</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Groups</Text>
        <View style={styles.headerBtn} />
      </View>

      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySubtitle}>Create one to get started</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.title}
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.data.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isOwner={group.ownerId === user?.id}
                  onPress={() =>
                    navigation.navigate('GroupDetail', { groupId: group.id })
                  }
                />
              ))}
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerBtn: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  headerBtnPlus: {
    fontSize: 28,
    fontWeight: '300',
    color: '#1976d2',
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
  },
  list: { padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#555', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 16, fontWeight: '600', flex: 1 },
  ownerBadge: {
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ownerBadgeText: { fontSize: 11, fontWeight: '600', color: '#1976d2' },
  cardMembers: { fontSize: 13, color: '#888', marginTop: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#999' },
  errorText: { fontSize: 15, color: '#d32f2f', marginBottom: 12 },
  retryBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
