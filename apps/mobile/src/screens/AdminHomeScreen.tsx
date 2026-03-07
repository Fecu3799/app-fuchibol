import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminHome'>;

interface SectionCardProps {
  title: string;
  description: string;
  onPress?: () => void;
  disabled?: boolean;
}

function SectionCard({ title, description, onPress, disabled = false }: SectionCardProps) {
  return (
    <Pressable
      style={[s.card, disabled && s.cardDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={[s.cardTitle, disabled && s.cardTitleDisabled]}>{title}</Text>
      <Text style={s.cardDescription}>{description}</Text>
      {disabled && <Text style={s.comingSoon}>Próximamente</Text>}
    </Pressable>
  );
}

export default function AdminHomeScreen({ navigation }: Props) {
  const { logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.header}>Panel de Administración</Text>

      <SectionCard
        title="Predios y Canchas"
        description="Gestionar predios, canchas, precios y disponibilidad."
        onPress={() => navigation.navigate('AdminVenues')}
      />
      <SectionCard
        title="Usuarios"
        description="Ver y gestionar cuentas de usuarios."
        disabled
      />
      <SectionCard
        title="Métricas"
        description="Estadísticas de uso y actividad de la plataforma."
        disabled
      />

      <View style={s.logoutSection}>
        <TouchableOpacity style={s.logoutButton} onPress={logout} activeOpacity={0.8}>
          <Text style={s.logoutButtonText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardDisabled: { backgroundColor: '#f5f5f5', borderColor: '#e8e8e8' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  cardTitleDisabled: { color: '#aaa' },
  cardDescription: { fontSize: 13, color: '#666' },
  comingSoon: {
    fontSize: 11,
    fontWeight: '600',
    color: '#bbb',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logoutSection: { marginTop: 24 },
  logoutButton: {
    backgroundColor: '#d32f2f',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
