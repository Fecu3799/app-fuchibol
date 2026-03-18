import { ActivityIndicator, Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { usePushNotifications } from '../features/push/usePushNotifications';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings, useUpdateUserSettings } from '../features/users/useUserSettings';
import type { UserSettings } from '../types/api';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Activar notificaciones',
  requesting: 'Solicitando…',
  registered: 'Notificaciones activas ✓ — toca para re-registrar',
  denied: 'Permiso denegado — revisá Configuración',
  error: 'Error — intentá de nuevo',
};

function SettingToggle({
  label,
  description,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleLabels}>
        <Text style={s.toggleLabel}>{label}</Text>
        {description ? <Text style={s.toggleDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#ccc', true: '#1976d2' }}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { status, expoPushToken, requestAndRegister, isSupported } = usePushNotifications();
  const { logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const settingsQuery = useUserSettings();
  const { mutate: updateSetting, isPending: isSaving } = useUpdateUserSettings();

  const label = STATUS_LABEL[status] ?? 'Activar notificaciones';
  const isRegistered = status === 'registered';
  const isLoading = status === 'requesting';

  const settings = settingsQuery.data;

  const toggle = (field: keyof UserSettings) => (value: boolean) => {
    updateSetting({ [field]: value });
  };

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerBtn} />
        <Text style={s.headerTitle}>Ajustes</Text>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={logout}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Text style={s.headerBtnLogout}>Salir</Text>
        </TouchableOpacity>
      </View>

      <View style={s.content}>
        {/* ── Device push ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notificaciones push</Text>

          {!isSupported ? (
            <Text style={s.unsupported}>
              {Platform.OS === 'web'
                ? 'No disponible en web.'
                : 'Requiere dispositivo físico.'}
            </Text>
          ) : (
            <TouchableOpacity
              style={[s.button, isRegistered && s.buttonSuccess]}
              onPress={requestAndRegister}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={s.buttonText}>{label}</Text>
            </TouchableOpacity>
          )}

          {__DEV__ && expoPushToken ? (
            <Text style={s.tokenDebug}>Token: …{expoPushToken.slice(-20)}</Text>
          ) : null}
        </View>

        {/* ── Notification preferences ── */}
        <View style={[s.section, s.sectionSpaced]}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Preferencias de notificaciones</Text>
            {isSaving ? <ActivityIndicator size="small" color="#1976d2" style={s.savingIndicator} /> : null}
          </View>

          {settingsQuery.isLoading ? (
            <ActivityIndicator size="small" color="#999" style={s.loadingSpinner} />
          ) : settingsQuery.isError ? (
            <View>
              <Text style={s.errorText}>Error al cargar preferencias.</Text>
              <TouchableOpacity onPress={() => void settingsQuery.refetch()} style={s.retryButton} activeOpacity={0.7}>
                <Text style={s.retryText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : settings ? (
            <>
              <SettingToggle
                label="Recordatorios de partidos"
                description="Avisos antes de que empiece tu partido"
                value={settings.pushMatchReminders}
                disabled={isSaving}
                onValueChange={toggle('pushMatchReminders')}
              />
              <View style={s.divider} />
              <SettingToggle
                label="Cambios en partidos"
                description="Invitaciones, confirmaciones, cambios de horario"
                value={settings.pushMatchChanges}
                disabled={isSaving}
                onValueChange={toggle('pushMatchChanges')}
              />
              <View style={s.divider} />
              <SettingToggle
                label="Mensajes de chat"
                description="Mensajes nuevos en grupos y partidos"
                value={settings.pushChatMessages}
                disabled={isSaving}
                onValueChange={toggle('pushChatMessages')}
              />
            </>
          ) : null}
        </View>

        {/* ── Account ── */}
        <View style={[s.section, s.sectionSpaced]}>
          <Text style={s.sectionTitle}>Cuenta</Text>
          <TouchableOpacity
            style={s.secondaryButton}
            onPress={() => navigation.navigate('Sessions')}
            activeOpacity={0.8}
          >
            <Text style={s.secondaryButtonText}>Gestionar dispositivos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.secondaryButton}
            onPress={() => navigation.navigate('ChangePassword')}
            activeOpacity={0.8}
          >
            <Text style={s.secondaryButtonText}>Cambiar contraseña</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
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
  content: { padding: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.06)',
  },
  sectionSpaced: { marginTop: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  savingIndicator: { marginLeft: 8 },
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
  loadingSpinner: { marginVertical: 8 },
  errorText: { color: '#c62828', fontSize: 14, marginBottom: 8 },
  retryButton: { alignSelf: 'flex-start' },
  retryText: { color: '#1976d2', fontSize: 14, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  toggleLabels: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 15, color: '#111' },
  toggleDesc: { fontSize: 13, color: '#777', marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  secondaryButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: { color: '#333', fontWeight: '600', fontSize: 15 },
});
