import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { PublicUserProfile, UserGender, PreferredPosition, SkillLevel } from '../types/api';
import { getPublicProfile } from '../features/auth/authClient';
import { Avatar } from '../components/Avatar';
import { ApiError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicUserProfile'>;

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

export default function PublicUserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const { user } = useAuth();
  const isSelf = user?.id === userId;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPublicProfile(userId)
      .then((data) => { if (!cancelled) { setProfile(data); setLoading(false); } })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof ApiError
          ? (err.body.detail ?? err.body.message ?? 'Error al cargar perfil')
          : 'Error de conexión';
        setError(typeof msg === 'string' ? msg : 'Error al cargar perfil');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error || 'Perfil no encontrado'}</Text>
      </View>
    );
  }

  const displayName =
    profile.firstName || profile.lastName
      ? [profile.firstName, profile.lastName].filter(Boolean).join(' ')
      : null;

  const handleMessage = () => {
    // Navigate instantly — DirectChatScreen resolves the conversation on mount.
    // No conversation is created until the first message is sent.
    navigation.navigate('DirectChat', {
      targetUserId: userId,
      otherUsername: profile.username ?? displayName ?? 'Usuario',
    });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Avatar uri={profile.avatarUrl} size={80} fallbackText={profile.username ?? displayName} />
        <View style={s.headerText}>
          <View style={s.nameRow}>
            <Text style={s.displayName} numberOfLines={1}>
              {displayName ?? profile.username ?? '—'}
            </Text>
            {profile.age != null && (
              <Text style={s.age}>{profile.age} años</Text>
            )}
          </View>
          {displayName && profile.username ? (
            <Text style={s.username}>@{profile.username}</Text>
          ) : null}
          {!isSelf && (
            <Pressable
              style={s.msgBtn}
              onPress={handleMessage}
            >
              <Text style={s.msgBtnText}>Mensaje</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Football data */}
      <View style={s.card}>
        <Text style={s.cardHeader}>Datos de juego</Text>
        <InfoRow
          label="Posición"
          value={profile.preferredPosition ? POSITION_LABEL[profile.preferredPosition] : '—'}
        />
        <InfoRow
          label="Nivel"
          value={profile.skillLevel ? SKILL_LABEL[profile.skillLevel] : '—'}
        />
        <InfoRow
          label="Género"
          value={profile.gender ? GENDER_LABEL[profile.gender] : '—'}
        />
      </View>

      {/* Reliability */}
      <View style={s.card}>
        <Text style={s.cardHeader}>Confiabilidad</Text>
        <InfoRow
          label={profile.reliabilityLabel}
          value={`${profile.reliabilityScore}/100`}
        />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 15, color: '#d32f2f', textAlign: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  displayName: { fontSize: 20, fontWeight: '700', color: '#111', flexShrink: 1 },
  age: { fontSize: 14, color: '#888', fontWeight: '500' },
  username: { fontSize: 13, color: '#888', marginTop: 2 },
  msgBtn: {
    marginTop: 10,
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    minWidth: 90,
    alignItems: 'center',
  },
  msgBtnDisabled: { opacity: 0.6 },
  msgBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: { fontSize: 14, fontWeight: '700', color: '#444', marginBottom: 10 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  infoLabel: { fontSize: 13, color: '#888' },
  infoValue: { fontSize: 13, color: '#222', fontWeight: '500', flexShrink: 1, textAlign: 'right' },
});
