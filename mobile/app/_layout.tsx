import '../global.css';
import * as SplashScreen from 'expo-splash-screen';
void SplashScreen.preventAutoHideAsync().catch(() => {});
import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Snackbar } from 'react-native-paper';
import { AppProvider, useApp } from '../src/services/AppProvider';
export { ErrorBoundary } from 'expo-router';
function Routes() {
  const { colors, notice, notify } = useApp();
  return (
    <>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      />
      <Snackbar
        visible={!!notice}
        onDismiss={() => notify('')}
        duration={5000}
        action={{ label: '关闭', onPress: () => notify('') }}
      >
        {notice}
      </Snackbar>
    </>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Routes />
      </AppProvider>
    </SafeAreaProvider>
  );
}
