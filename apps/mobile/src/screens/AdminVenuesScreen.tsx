import { useCallback, useEffect, useState } from 'react';
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
import type { VenueAdmin } from '../types/api';
import { listVenuesAdmin, updateVenueAdmin } from '../features/admin/adminClient';
import { ApiError } from '../lib/api';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminVenues'>;

function VenueRow({
  venue,
  onEdit,
  onPitches,
  onToggleActive,
  toggling,
}: {
  venue: VenueAdmin;
  onEdit: () => void;
  onPitches: () => void;
  onToggleActive: () => void;
  toggling: boolean;
}) {
  return (
    <View style={s.row}>
      <View style={s.rowMain}>
        <View style={s.rowHeader}>
          <Text style={s.rowName} numberOfLines={1}>{venue.name}</Text>
          <View style={[s.badge, venue.isActive ? s.badgeActive : s.badgeInactive]}>
            <Text style={s.badgeText}>{venue.isActive ? 'ACTIVO' : 'INACTIVO'}</Text>
          </View>
        </View>
        {venue.addressText ? (
          <Text style={s.rowSub} numberOfLines={1}>{venue.addressText}</Text>
        ) : null}
        <Text style={s.rowSub}>{venue.pitchCount} {venue.pitchCount === 1 ? 'cancha' : 'canchas'}</Text>
      </View>
      <View style={s.rowActions}>
        <Pressable style={s.actionBtn} onPress={onPitches}>
          <Text style={s.actionBtnText}>Canchas</Text>
        </Pressable>
        <Pressable style={s.actionBtn} onPress={onEdit}>
          <Text style={s.actionBtnText}>Editar</Text>
        </Pressable>
        <Pressable
          style={[s.actionBtn, venue.isActive ? s.actionBtnDeactivate : s.actionBtnActivate, toggling && s.actionBtnDisabled]}
          onPress={onToggleActive}
          disabled={toggling}
        >
          <Text style={s.actionBtnText}>{venue.isActive ? 'Desactivar' : 'Activar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminVenuesScreen({ navigation }: Props) {
  const [venues, setVenues] = useState<VenueAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await listVenuesAdmin();
      setVenues(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? (err.body.detail ?? err.body.message ?? 'Error') : 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload on screen focus (after form saves)
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleToggleActive = async (venue: VenueAdmin) => {
    setTogglingId(venue.id);
    try {
      const updated = await updateVenueAdmin(venue.id, { isActive: !venue.isActive });
      setVenues((prev) => prev.map((v) => (v.id === updated.id ? { ...v, isActive: updated.isActive } : v)));
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
      {error ? <Text style={s.error}>{error}</Text> : null}
      <FlatList
        data={venues}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <VenueRow
            venue={item}
            onEdit={() => navigation.navigate('AdminVenueForm', { venueId: item.id })}
            onPitches={() => navigation.navigate('AdminVenuePitches', { venueId: item.id, venueName: item.name })}
            onToggleActive={() => void handleToggleActive(item)}
            toggling={togglingId === item.id}
          />
        )}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>No hay predios creados aún.</Text>}
      />
      <View style={s.footer}>
        <Pressable style={s.newBtn} onPress={() => navigation.navigate('AdminVenueForm', {})}>
          <Text style={s.newBtnText}>+ Nuevo Predio</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  rowName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111' },
  rowSub: { fontSize: 12, color: '#888', marginTop: 1 },

  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeActive: { backgroundColor: '#e8f5e9' },
  badgeInactive: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#ddd' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#444' },

  rowActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
  newBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 13,
    alignItems: 'center',
  },
  newBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
