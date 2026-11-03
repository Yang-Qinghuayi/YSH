import * as SplashScreen from 'expo-splash-screen';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import {
  ActivityIndicator,
  Button,
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  Text,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VariableContextProvider } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from '../domain/models';
import { createColors, nativeVariables, withAlpha } from '../theme/colors';
import type { Repository } from './repository';
import { loadRepository } from './database';
const KEY = 'ysh.mobile.settings.v1';
const Context = createContext<{
  repo: Repository;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  dark: boolean;
  colors: ReturnType<typeof createColors>;
  notice: string;
  notify: (message: string) => void;
} | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('AppProvider missing');
  return value;
}
export function AppProvider({ children }: React.PropsWithChildren) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [repo, setRepo] = useState<Repository>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [notice, notify] = useState('');
  const initialized = useRef(false);
  const writeQueue = useRef(Promise.resolve());
  const system = useColorScheme();
  const dark = settings.mode === 'dark' || (settings.mode === 'system' && system === 'dark');
  const colors = useMemo(() => createColors(settings.seed, dark), [settings.seed, dark]);
  const theme = useMemo(
    () => ({
      ...(dark ? MD3DarkTheme : MD3LightTheme),
      colors: {
        ...(dark ? MD3DarkTheme : MD3LightTheme).colors,
        ...colors,
        surfaceDisabled: withAlpha(colors.onSurface, 0.12),
        onSurfaceDisabled: withAlpha(colors.onSurface, 0.38),
        backdrop: withAlpha(colors.onSurface, 0.4),
        elevation: {
          level0: 'transparent',
          level1: colors.surfaceContainerLow,
          level2: colors.surfaceContainer,
          level3: colors.surfaceContainerHigh,
          level4: colors.surfaceContainerHigh,
          level5: colors.surfaceContainerHigh,
        },
      },
    }),
    [colors, dark]
  );
  useEffect(() => {
    let active = true;
    setError('');
    void (async () => {
      const stored = await AsyncStorage.getItem(KEY);
      let restored = DEFAULT_SETTINGS;
      if (stored) {
        try {
          restored = parseSettings(JSON.parse(stored));
        } catch {
          /* recover malformed preferences */
        }
      }
      const repository = await loadRepository();
      if (active) {
        setSettings(restored);
        initialized.current = true;
        setRepo(repository);
      }
    })().catch((e) => {
      if (active) setError(String(e));
    });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (repo || error) void SplashScreen.hideAsync().catch(() => {});
  }, [repo, error]);
  const updateSettings = (patch: Partial<Settings>) =>
    setSettings((old) => parseSettings({ ...old, ...patch }));
  useEffect(() => {
    if (!initialized.current) return;
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(KEY, JSON.stringify(settings)))
      .catch(() => notify('设置保存失败，请检查设备存储空间'));
  }, [settings]);
  return (
    <VariableContextProvider value={nativeVariables(colors)}>
      <PaperProvider theme={theme}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        {!repo ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 20,
              backgroundColor: colors.background,
              padding: 24,
            }}
          >
            {error ? (
              <>
                <Text>初始化失败：{error}</Text>
                <Button onPress={() => setAttempt((x) => x + 1)}>重试</Button>
              </>
            ) : (
              <>
                <ActivityIndicator />
                <Text>正在打开本地书库…</Text>
              </>
            )}
          </View>
        ) : (
          <Context.Provider
            value={{ repo, settings, updateSettings, dark, colors, notice, notify }}
          >
            {children}
          </Context.Provider>
        )}
      </PaperProvider>
    </VariableContextProvider>
  );
}
