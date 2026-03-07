import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { AdminStackParamList } from '../navigation/AppNavigator';
import type { PitchAdmin } from '../types/api';
import { listPitchesAdmin, updatePitchAdmin } from '../features/admin/adminClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminVenuePitches'>;

function PitchRow({
  pitch,
  onEdit,
  onToggleActive,
  toggling,
}: {
  pitch: PitchAdmin;
  onEdit: () => void;
  onToggleActive: () => void;
  toggling: boolean;
}) {
  const priceLabel = pitch.price != null ? `$${pitch.price.toLocaleString('es-AR')}` : 'Sin precio';
  return (
    <View style={s.row}>
      <View style={s.rowMain}>
        <View style={s.rowHeader}>
          <Text style={s.rowName} numberOfLines={1}>{pitch.name}</Text>
          <View style={s.typeBadge}>
            <Text style={s.typeBadgeText}>{pitch.pitchType}</Text>
          </View>
          <View style={[s.badge, pitch.isActive ? s.badgeActive : s.badgeInactive]}>
            <Text style={s.badgeText}>{pitch.isActive ? 'ACTIVA' : 'INACTIVA'}</Text>
          </View>
        </View>
        <Text style={s.rowSub}>{priceLabel}</Text>
      </View>
      <View style={s.rowActions}>
        <Pressable style={s.actionBtn} onPress={onEdit}>
          <Text style={s.actionBtnText}>Editar</Text>
        </Pressable>
        <Pressable
          style={[
            s.actionBtn,
            pitch.isActive ? s.actionBtnDeactivate : s.actionBtnActivate,
            toggling && s.actionBtnDisabled,
          ]}
          onPress={onToggleActive}
          disabled={toggling}
        >
          <Text style={s.actionBtnText}>{pitch.isActive ? 'Desactivar' : 'Activar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminVenuePitchesScreen({ route, navigation }: Props) {
  const { venueId, venueName } = route.params;
  const [pitches, setPitches] = useState<PitchAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await listPitchesAdmin(venueId);
      setPitches(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? (err.body.detail ?? err.body.message ?? 'Error') : 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleToggleActive = async (pitch: PitchAdmin) => {
    setTogglingId(pitch.id);
    try {
      const updated = await updatePitchAdmin(venueId, pitch.id, { isActive: !pitch.isActive });
      setPitches((prev) => prev.map((p) => (p.id === updated.id ? { ...p, isActive: updated.isActive } : p)));
    } catch (err) {
      setError(err instanceof ApiError ? (err.body.detail ?? err.body.message ?? 'Error') : 'Error de conexión.');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={s.flex}>
      <Text style={s.venueLabel}>{venueName}</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <FlatList
        data={pitches}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PitchRow
            pitch={item}
            onEdit={() => navigation.navigate('AdminPitchForm', { venueId, pitchId: item.id })}
            onToggleActive={() => void handleToggleActive(item)}
            toggling={togglingId === item.id}
          />
        )}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>No hay canchas creadas para este predio.</Text>}
      />
      <View style={s.footer}>
        <Pressable style={s.newBtn} onPress={() => navigation.navigate('AdminPitchForm', { venueId })}>
          <Text style={s.newBtnText}>+ Nueva Cancha</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  venueLabel: { fontSize: 13, fontWeight: '600', color: '#888', marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  list: { padding: 12, paddingBottom: 0 },
  error: { color: '#d32f2f', margin: 12, textAlign: 'center' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },

  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rowMain: { marginBottom: 8 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' },
  rowName: { fontSize: 15, fontWeight: '700', color: '#111', flexShrink: 1 },
  rowSub: { fontSize: 12, color: '#888' },

  typeBadge: { backgroundColor: '#1976d2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeActive: { backgroundColor: '#e8f5e9' },
  badgeInactive: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#ddd' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#444' },

  rowActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f0f0f0',
  },
  actionBtnDeactivate: { backgroundColor: '#fff3e0' },
  actionBtnActivate: { backgroundColor: '#e8f5e9' },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#333' },

  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  newBtn: { backgroundColor: '#1976d2', borderRadius: 8, padding: 13, alignItems: 'center' },
  newBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
