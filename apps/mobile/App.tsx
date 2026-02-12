import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiBaseUrl } from './src/config/env';
import { getHealth } from './src/features/health/healthClient';

export default function App() {
  const [status, setStatus] = useState('Smoke test running...');

  useEffect(() => {
    console.log('[smoke] API base URL:', apiBaseUrl);

    getHealth()
      .then((data) => {
        console.log('[smoke] Health OK:', JSON.stringify(data));
        setStatus(`Connected: ${data.service} @ ${data.time}`);
      })
      .catch((err) => {
        console.error('[smoke] Health FAILED:', apiBaseUrl, err);
        setStatus(`Failed: ${String(err)}`);
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Fuchibol — Smoke Test</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.url}>{apiBaseUrl}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  label: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  status: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
  url: { fontSize: 12, color: '#888' },
});
