import { Text } from './Typography';
import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Button, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { layoutForWidth } from '../domain/models';
import { useApp } from '../services/AppProvider';
export function Shell({
  children,
  title,
  action,
}: React.PropsWithChildren<{ title: string; action?: React.ReactNode }>) {
  const { colors } = useApp();
  const { expanded } = layoutForWidth(useWindowDimensions().width);
  const router = useRouter();
  const path = usePathname();
  const links = [
    { path: '/' as const, title: '书库', icon: 'bookshelf' },
    { path: '/settings' as const, title: '设置', icon: 'palette-outline' },
  ];
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <View className="flex-1 flex-row">
        {expanded && (
          <View className="w-24 items-center gap-5 bg-surface-container py-6">
            <Text variant="titleLarge">YSH</Text>
            {links.map((link) => (
              <View key={link.path} className="items-center">
                <IconButton
                  icon={link.icon}
                  mode={path === link.path ? 'contained' : undefined}
                  accessibilityLabel={link.title}
                  onPress={() => router.replace(link.path)}
                />
                <Text>{link.title}</Text>
              </View>
            ))}
          </View>
        )}
        <View className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-3">
            <Text variant="headlineMedium">{title}</Text>
            {action}
          </View>
          {children}
          {!expanded && (
            <View className="flex-row justify-around bg-surface-container py-2">
              {links.map((link) => (
                <Button
                  key={link.path}
                  icon={link.icon}
                  mode={path === link.path ? 'contained-tonal' : 'text'}
                  onPress={() => router.replace(link.path)}
                >
                  {link.title}
                </Button>
              ))}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
