import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PreferredPosition, SkillLevel, UserGender } from '../types/api';
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { postAvatarPrepare, postAvatarConfirm } from '../features/auth/authClient';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'ProfileTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

// ── Label maps ──

const GENDER_LABEL: Record<UserGender, string> = {
  MALE: 'Masculino',
  FEMALE: 'Femenino',
  OTHER: 'Otro',
};

const POSITION_LABEL: Record<PreferredPosition, string> = {
  GOALKEEPER: 'Arquero',
  DEFENDER: 'Defensor',
  MIDFIELDER: 'Mediocampista',
  FORWARD: 'Delantero',
};

const SKILL_LABEL: Record<SkillLevel, string> = {
  BEGINNER: 'Principiante',
  AMATEUR: 'Amateur',
  REGULAR: 'Regular',
  SEMIPRO: 'Semiprofesional',
  PRO: 'Profesional',
};

function formatBirthDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${day}-${month}-${d.getUTCFullYear()}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handlePickAvatar = async () => {
    setUploadError('');

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setUploadError('Necesitás dar permiso para acceder a tus fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType ?? 'image/jpeg';

    let size = asset.fileSize ?? 0;
    if (size === 0) {
      const info = await FileSystem.getInfoAsync(asset.uri);
      if (info.exists && 'size' in info) size = (info as { size: number }).size;
    }

    setUploading(true);
    let step = 'prepare';
    try {
      const { uploadUrl, key } = await postAvatarPrepare({ contentType, size });

      step = 'upload';
      if (__DEV__) {
        console.log('[Avatar] uri:', asset.uri, 'contentType:', contentType, 'size:', size);
      }
      const fileRes = await fetch(asset.uri);
      const blob = await fileRes.blob();
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });
      if (__DEV__) {
        console.log('[Avatar] PUT status:', putRes.status);
      }
      if (putRes.status < 200 || putRes.status >= 300) {
        const body = await putRes.text().catch(() => '');
        throw new Error(`PUT falló con status ${putRes.status}: ${body}`);
      }

      step = 'confirm';
      await postAvatarConfirm({ key, contentType, size });

      step = 'refresh';
      await refreshUser();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Avatar] falló en paso "${step}":`, msg);
      setUploadError(`Error en paso "${step}": ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const isProfileIncomplete = !user?.preferredPosition || !user?.skillLevel;

  const displayName =
    user?.firstName || user?.lastName
      ? [user.firstName, user.lastName].filter(Boolean).join(' ')
      : null;

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={s.headerBtn}
          onPress={() => navigation.navigate('EditProfile')}
          hitSlop={8}
        >
          <Text style={s.headerBtnText}>Editar</Text>
        </Pressable>

        <Text style={s.headerTitle}>Perfil</Text>

        <Pressable
          style={s.headerBtn}
          onPress={() => navigation.navigate('MatchHistory')}
          hitSlop={8}
        >
          <Text style={s.headerBtnText}>Historial</Text>
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* Completeness banner */}
        {isProfileIncomplete && (
          <View style={s.banner}>
            <Text style={s.bannerText}>
              ✦ Completá tu perfil — falta posición o nivel de juego
            </Text>
          </View>
        )}

        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatarCircle}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={s.avatarImage} />
            ) : (
              <Text style={s.avatarInitial}>
                {(user?.firstName ?? user?.username ?? '?')[0].toUpperCase()}
              </Text>
            )}
          </View>
          {Platform.OS !== 'web' ? (
            <TouchableOpacity
              onPress={handlePickAvatar}
              disabled={uploading}
              activeOpacity={0.7}
              style={s.changePhotoBtn}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#1976d2" />
              ) : (
                <Text style={s.changePhotoText}>Cambiar foto</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={s.webNote}>Foto disponible en mobile</Text>
          )}
          {uploadError ? <Text style={s.uploadError}>{uploadError}</Text> : null}
        </View>

        {/* Identity card */}
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardTitle} numberOfLines={1}>
              {displayName ?? user?.username ?? user?.email ?? '—'}
            </Text>
            {user?.age != null && (
              <Text style={s.cardAge}>{user.age} años</Text>
            )}
          </View>
          {displayName && user?.username ? (
            <Text style={s.cardSubtitle}>@{user.username}</Text>
          ) : null}

          <View style={s.divider} />

          <InfoRow label="Email" value={user?.email ?? '—'} />
          <InfoRow label="Género" value={user?.gender ? GENDER_LABEL[user.gender] : '—'} />
          <InfoRow label="Fecha de nacimiento" value={formatBirthDate(user?.birthDate)} />
        </View>

        {/* Football card */}
        <View style={s.card}>
          <Text style={s.cardHeader}>Datos de juego</Text>
          <InfoRow
            label="Posición"
            value={user?.preferredPosition ? POSITION_LABEL[user.preferredPosition] : '—'}
          />
          <InfoRow
            label="Nivel"
            value={user?.skillLevel ? SKILL_LABEL[user.skillLevel] : '—'}
          />
        </View>

        {/* Reliability card */}
        {user?.suspendedUntil && new Date(user.suspendedUntil) > new Date() ? (
          <View style={s.suspensionBanner}>
            <Text style={s.suspensionText}>
              Cuenta suspendida hasta{' '}
              {new Date(user.suspendedUntil).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        ) : null}
        <View style={s.card}>
          <Text style={s.cardHeader}>Confiabilidad</Text>
          <InfoRow
            label={user?.reliabilityLabel ?? '—'}
            value={`${user?.reliabilityScore ?? 100}/100`}
          />
        </View>
      </ScrollView>
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
  headerBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1976d2',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 88, height: 88 },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: '#1976d2' },
  changePhotoBtn: { marginTop: 8 },
  changePhotoText: { fontSize: 13, color: '#1976d2', fontWeight: '500' },
  webNote: { fontSize: 12, color: '#999', marginTop: 8 },
  uploadError: { fontSize: 12, color: '#d32f2f', marginTop: 6, textAlign: 'center' },

  banner: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  bannerText: { fontSize: 13, color: '#92400e', fontWeight: '500' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.04)',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 2, flexShrink: 1 },
  cardAge: { fontSize: 14, color: '#888', fontWeight: '500' },
  cardSubtitle: { fontSize: 13, color: '#888', marginBottom: 8 },
  cardHeader: { fontSize: 14, fontWeight: '700', color: '#444', marginBottom: 10 },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 10 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  infoLabel: { fontSize: 13, color: '#888' },
  infoValue: { fontSize: 13, color: '#222', fontWeight: '500', flexShrink: 1, textAlign: 'right' },

  suspensionBanner: {
    backgroundColor: '#fde8e8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#d32f2f',
  },
  suspensionText: { fontSize: 13, color: '#7f0000', fontWeight: '600' },
});
