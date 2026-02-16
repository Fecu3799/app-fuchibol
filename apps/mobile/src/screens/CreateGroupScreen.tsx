import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useCreateGroup } from '../features/groups/useCreateGroup';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export default function CreateGroupScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const mutation = useCreateGroup();

  const handleCreate = () => {
    if (!name.trim()) return;
    setError('');
    mutation.mutate(
      { name: name.trim() },
      {
        onSuccess: (result) => {
          navigation.replace('GroupDetail', { groupId: result.id });
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            setError(err.body.detail ?? err.body.message ?? 'Something went wrong');
          } else {
            setError('Connection error. Please try again.');
          }
        },
      },
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Group Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Friday Football"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (error) setError('');
        }}
        autoFocus
        maxLength={100}
        editable={!mutation.isPending}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[
          styles.createBtn,
          (!name.trim() || mutation.isPending) && styles.btnDisabled,
        ]}
        onPress={handleCreate}
        disabled={!name.trim() || mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.createBtnText}>Create Group</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 24 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  error: { color: '#d32f2f', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  createBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
