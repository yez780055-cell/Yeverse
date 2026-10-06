import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.yeverse.app',
  appName: 'Yeverse',
  webDir: 'dist',
  server: { hostname: 'localhost', androidScheme: 'https' },
  android: { backgroundColor: '#101112', allowMixedContent: false },
  plugins: { SystemBars: { style: 'DARK' } },
};
export default config;
