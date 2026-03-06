import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PreferredPosition, SkillLevel, UserGender } from '../types/api';
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';

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
  const { user, logout } = useAuth();

  const isProfileIncomplete = !user?.preferredPosition || !user?.skillLevel;

  const displayName =
    user?.firstName || user?.lastName
      ? [user.firstName, user.lastName].filter(Boolean).join(' ')
      : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Perfil</Text>

      {/* Completeness banner */}
      {isProfileIncomplete && (
        <View style={s.banner}>
          <Text style={s.bannerText}>
            ✦ Completá tu perfil — falta posición o nivel de juego
          </Text>
        </View>
      )}

      {/* Identity card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>{displayName ?? user?.username ?? user?.email ?? '—'}</Text>
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

      {/* Navigation */}
      <Pressable style={s.menuRow} onPress={() => navigation.navigate('EditProfile')}>
        <Text style={s.menuRowText}>Editar perfil</Text>
        <Text style={s.chevron}>&gt;</Text>
      </Pressable>

      <Pressable style={s.menuRow} onPress={() => navigation.navigate('MatchHistory')}>
        <Text style={s.menuRowText}>Historial de partidos</Text>
        <Text style={s.chevron}>&gt;</Text>
      </Pressable>

      <Pressable style={s.logoutBtn} onPress={logout}>
        <Text style={s.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },

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
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 2 },
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
    marginTop: 8,
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
