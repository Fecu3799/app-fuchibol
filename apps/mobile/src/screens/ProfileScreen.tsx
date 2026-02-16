import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'ProfileTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function ProfileScreen({ navigation }: Props) {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <Pressable
        style={styles.menuRow}
        onPress={() => navigation.navigate('MatchHistory')}
      >
        <Text style={styles.menuRowText}>Match History</Text>
        <Text style={styles.chevron}>&gt;</Text>
      </Pressable>

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 60, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  menuRowText: { fontSize: 16, fontWeight: '500' },
  chevron: { fontSize: 18, color: '#999' },
  logoutBtn: {
    backgroundColor: '#d32f2f',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
