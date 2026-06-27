import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'me.travisgilbert.commonplace',
  appName: 'CommonPlace',
  webDir: 'out',
  server: {
    appStartPath: '/commonplace/mobile',
    ...(serverUrl
      ? {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
        }
      : {}),
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
