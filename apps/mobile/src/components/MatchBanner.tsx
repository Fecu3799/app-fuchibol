import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BannerInfo } from '../features/matches/useMatchUxSignals';

const BANNER_COLORS: Record<string, { bg: string; text: string }> = {
  canceled: { bg: '#ffebee', text: '#c62828' },
  reconfirm: { bg: '#fff8e1', text: '#e65100' },
  promoted: { bg: '#e8f5e9', text: '#1b5e20' },
  reconnecting: { bg: '#f5f5f5', text: '#616161' },
};

interface Props {
  banner: BannerInfo;
  onDismiss?: () => void;
}

export function MatchBanner({ banner, onDismiss }: Props) {
  const colors = BANNER_COLORS[banner.type] ?? { bg: '#f5f5f5', text: '#333' };
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
        {banner.message}
      </Text>
      {banner.dismissible && onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismissBtn}>
          <Text style={[styles.dismiss, { color: colors.text }]}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  message: { fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  dismissBtn: { marginLeft: 8 },
  dismiss: { fontSize: 15, fontWeight: '700' },
});
