import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { usePushNotifications } from '../features/push/usePushNotifications';
import { useAuth } from '../contexts/AuthContext';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Enable notifications',
  requesting: 'Requesting…',
  registered: 'Notifications enabled ✓ — tap to re-register',
  denied: 'Permission denied — check Settings',
  error: 'Error — try again',
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { status, expoPushToken, requestAndRegister, isSupported } = usePushNotifications();
  const { logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const label = STATUS_LABEL[status] ?? 'Enable notifications';
  const isRegistered = status === 'registered';
  const isLoading = status === 'requesting';

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerBtn} />
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={logout}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Text style={styles.headerBtnLogout}>Log out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>

          {!isSupported ? (
            <Text style={styles.unsupported}>
              {Platform.OS === 'web'
                ? 'Not supported in web browser.'
                : 'Requires a physical device.'}
            </Text>
          ) : (
            <TouchableOpacity
              style={[styles.button, isRegistered && styles.buttonSuccess]}
              onPress={requestAndRegister}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{label}</Text>
            </TouchableOpacity>
          )}

          {/* DEV: show partial token for debugging */}
          {__DEV__ && expoPushToken ? (
            <Text style={styles.tokenDebug}>
              Token: …{expoPushToken.slice(-20)}
            </Text>
          ) : null}
        </View>

        <View style={[styles.section, styles.sectionDanger]}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.changePasswordButton}
            onPress={() => navigation.navigate('Sessions')}
            activeOpacity={0.8}
          >
            <Text style={styles.changePasswordButtonText}>Manage devices</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.changePasswordButton}
            onPress={() => navigation.navigate('ChangePassword')}
            activeOpacity={0.8}
          >
            <Text style={styles.changePasswordButtonText}>Change password</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
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
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
  },
  headerBtnLogout: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d32f2f',
  },
  content: { padding: 24 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.06)',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  button: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonSuccess: { backgroundColor: '#388e3c' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  unsupported: { color: '#999', fontSize: 14 },
  tokenDebug: { marginTop: 10, fontSize: 11, color: '#aaa', fontFamily: 'monospace' },
  sectionDanger: { marginTop: 24 },
  changePasswordButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  changePasswordButtonText: { color: '#333', fontWeight: '600', fontSize: 15 },
});
