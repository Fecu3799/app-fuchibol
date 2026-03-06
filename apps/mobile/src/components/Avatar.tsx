import { Image, StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  size?: number;
  /** First character used as fallback initial */
  fallbackText?: string | null;
}

export function Avatar({ uri, size = 36, fallbackText }: AvatarProps) {
  const radius = size / 2;
  const fontSize = Math.round(size * 0.44);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, { width: size, height: size, borderRadius: radius }]}
      />
    );
  }

  const initial = fallbackText ? fallbackText[0].toUpperCase() : '?';
  return (
    <View style={[styles.base, styles.placeholder, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  placeholder: { backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '700', color: '#1976d2' },
});
