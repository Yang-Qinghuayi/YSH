import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'YSH 阅读',
  slug: 'ysh-mobile',
  version: '0.1.0',
  scheme: 'ysh',
  platforms: ['ios', 'android'],
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: 'com.qinghuayi.ysh.reader', supportsTablet: true },
  android: { package: 'com.qinghuayi.ysh.reader' },
  plugins: [
    ['expo-splash-screen', { backgroundColor: '#fff8f5', dark: { backgroundColor: '#1b1411' } }],
    'expo-router',
    'expo-dev-client',
    'expo-sqlite',
    [
      'expo-build-properties',
      { android: { kotlinVersion: '2.3.20', extraMavenRepos: ['https://jitpack.io'] } },
    ],
    './plugins/withReadium.cjs',
  ],
};
export default config;
