import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { GroupMember } from '../types/api';
import { useGroup } from '../features/groups/useGroup';
import { useAddGroupMember } from '../features/groups/useAddGroupMember';
import { useRemoveGroupMember } from '../features/groups/useRemoveGroupMember';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

function formatAddError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Connection error. Please try again.';
  const code = err.code;
  if (code === 'USER_NOT_FOUND') return 'User not found';
  if (code === 'ALREADY_MEMBER') return 'User is already a member';
  if (err.status === 422) {
    const msg = err.body.detail ?? err.body.message;
    return typeof msg === 'string' ? msg : 'Validation error';
  }
  return err.body.detail ?? err.body.message ?? 'Something went wrong';
}

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const { data: group, isLoading, error, refetch } = useGroup(groupId);
  const addMutation = useAddGroupMember(groupId);
  const removeMutation = useRemoveGroupMember(groupId);

  const [addInput, setAddInput] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [addMsgType, setAddMsgType] = useState<'success' | 'error'>('success');

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !group) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load group</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const isOwner = group.ownerId === user?.id;

  const handleAdd = () => {
    if (!addInput.trim()) return;
    setAddMsg('');
    addMutation.mutate(addInput.trim(), {
      onSuccess: () => {
        setAddMsg('Member added!');
        setAddMsgType('success');
        setAddInput('');
      },
      onError: (err) => {
        setAddMsg(formatAddError(err));
        setAddMsgType('error');
      },
    });
  };

  const handleRemove = (member: GroupMember) => {
    const isSelf = member.userId === user?.id;
    const title = isSelf ? 'Leave Group' : 'Remove Member';
    const message = isSelf
      ? 'Are you sure you want to leave this group?'
      : `Remove @${member.username} from the group?`;

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isSelf ? 'Leave' : 'Remove',
        style: 'destructive',
        onPress: () => {
          removeMutation.mutate(member.userId, {
            onSuccess: () => {
              if (isSelf) navigation.goBack();
            },
          });
        },
      },
    ]);
  };

  const renderMember = ({ item }: { item: GroupMember }) => {
    const isSelf = item.userId === user?.id;
    const isGroupOwner = item.userId === group.ownerId;
    const canRemove = isOwner ? !isGroupOwner : isSelf;

    return (
      <View style={styles.memberRow}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>@{item.username}</Text>
          {isGroupOwner && (
            <View style={styles.ownerTag}>
              <Text style={styles.ownerTagText}>Owner</Text>
            </View>
          )}
        </View>
        {canRemove && (
          <Pressable
            style={styles.removeBtn}
            onPress={() => handleRemove(item)}
            disabled={removeMutation.isPending}
          >
            <Text style={styles.removeBtnText}>
              {isSelf ? 'Leave' : 'Remove'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{group.name}</Text>
        <Text style={styles.memberCount}>
          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>

      {isOwner && (
        <View style={styles.addBlock}>
          <Text style={styles.addLabel}>Add Member</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="@username or email"
              value={addInput}
              onChangeText={(t) => {
                setAddInput(t);
                if (addMsg) setAddMsg('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!addMutation.isPending}
            />
            <Pressable
              style={[
                styles.addBtn,
                (!addInput.trim() || addMutation.isPending) && styles.btnDisabled,
              ]}
              onPress={handleAdd}
              disabled={!addInput.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.addBtnText}>Add</Text>
              )}
            </Pressable>
          </View>
          {addMsg ? (
            <Text
              style={[
                styles.addMsg,
                addMsgType === 'error' ? styles.addMsgError : styles.addMsgSuccess,
              ]}
            >
              {addMsg}
            </Text>
          ) : null}
        </View>
      )}

      <FlatList
        data={group.members}
        keyExtractor={(m) => m.userId}
        renderItem={renderMember}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 22, fontWeight: '700' },
  memberCount: { fontSize: 14, color: '#888', marginTop: 4 },
  list: { paddingHorizontal: 16, paddingTop: 8 },

  // Add member
  addBlock: {
    padding: 16,
    backgroundColor: '#f0f4ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  addLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  addRow: { flexDirection: 'row', gap: 10 },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  addBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  addMsg: { marginTop: 8, fontSize: 13, textAlign: 'center' },
  addMsgSuccess: { color: '#2e7d32' },
  addMsgError: { color: '#d32f2f' },
  btnDisabled: { opacity: 0.5 },

  // Member row
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  memberName: { fontSize: 15, fontWeight: '500' },
  ownerTag: {
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ownerTagText: { fontSize: 11, fontWeight: '600', color: '#1976d2' },
  removeBtn: {
    backgroundColor: '#ffebee',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeBtnText: { color: '#d32f2f', fontSize: 13, fontWeight: '600' },

  // Error states
  errorText: { fontSize: 15, color: '#d32f2f', marginBottom: 12 },
  retryBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
