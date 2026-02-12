const raw = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!raw) {
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL is not set.\n' +
      'Create apps/mobile/.env with:\n' +
      '  EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LAN_IP>:3000\n' +
      'Get your IP: ipconfig getifaddr en0',
  );
}

// Strip trailing slash if present
export const apiBaseUrl = raw.replace(/\/+$/, '');
