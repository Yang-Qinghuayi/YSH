import { Text } from '../src/components/Typography';
import React, { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import {
  Button,
  Card,
  Chip,
  HelperText,
  SegmentedButtons,
  Switch,
  TextInput,
} from 'react-native-paper';
import { Shell } from '../src/components/Shell';
import { useApp } from '../src/services/AppProvider';
import { normalizeSeed, PALETTES, type Settings } from '../src/domain/models';
export default function SettingsScreen() {
  const { settings, updateSettings, colors } = useApp();
  const [draft, setDraft] = useState(settings.seed);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(settings.seed);
  }, [settings.seed]);
  const wide = useWindowDimensions().width >= 900;
  return (
    <Shell title="主题与阅读">
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 0,
          gap: 20,
          maxWidth: 1200,
          width: '100%',
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-on-surface-variant">颜色来自一颗种子，应用与你一起变化。</Text>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20 }}>
          <Card style={{ flex: 1 }}>
            <Card.Title title="全局主题" subtitle="界面和正文共享语义色" />
            <Card.Content style={{ gap: 18 }}>
              <SegmentedButtons
                value={settings.mode}
                onValueChange={(mode) => updateSettings({ mode: mode as Settings['mode'] })}
                buttons={[
                  { value: 'system', label: '系统' },
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' },
                ]}
              />
              <View className="flex-row flex-wrap gap-2">
                {PALETTES.map((p) => (
                  <Chip
                    key={p.seed}
                    selected={settings.seed === p.seed}
                    onPress={() => {
                      setInvalid(false);
                      updateSettings({ seed: p.seed });
                    }}
                    avatar={
                      <View
                        style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: p.seed }}
                      />
                    }
                  >
                    {p.label}
                  </Chip>
                ))}
              </View>
              <TextInput
                label="自定义种子色"
                value={draft}
                onChangeText={(s) => {
                  setDraft(s);
                  setInvalid(false);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={7}
                error={invalid}
                placeholder="#b86545"
              />
              {invalid && <HelperText type="error">请输入 #rgb 或 #rrggbb 格式的颜色</HelperText>}
              <Button
                mode="contained"
                onPress={() => {
                  const seed = normalizeSeed(draft);
                  if (!seed) setInvalid(true);
                  else updateSettings({ seed });
                }}
              >
                应用种子色
              </Button>
              <View className="flex-row gap-2">
                {[colors.primary, colors.secondary, colors.tertiary, colors.surfaceContainer].map(
                  (c, i) => (
                    <View
                      key={i}
                      style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: c }}
                    />
                  )
                )}
              </View>
            </Card.Content>
          </Card>
          <Card style={{ flex: 1 }}>
            <Card.Title title="阅读偏好" subtitle="仅应用于当前格式支持的能力" />
            <Card.Content style={{ gap: 14 }}>
              <View className="flex-row items-center justify-between">
                <Text>连续滚动</Text>
                <Switch
                  accessibilityLabel="连续滚动"
                  value={settings.scroll}
                  onValueChange={(scroll) => updateSettings({ scroll })}
                />
              </View>
              <View className="flex-row items-center justify-between">
                <Text>大屏允许双页/双列</Text>
                <Switch
                  accessibilityLabel="大屏双页"
                  value={settings.spread}
                  onValueChange={(spread) => updateSettings({ spread })}
                />
              </View>
              <SegmentedButtons
                value={settings.fontFamily}
                onValueChange={(fontFamily) =>
                  updateSettings({ fontFamily: fontFamily as Settings['fontFamily'] })
                }
                buttons={[
                  { value: 'serif', label: '衬线' },
                  { value: 'sans-serif', label: '无衬线' },
                  { value: 'OpenDyslexic', label: '易读' },
                ]}
              />
              <Text>字体、行高与边距也可以在阅读器中调整。PDF 的固定页面不会随字号重排。</Text>
              <Text className="text-on-surface-variant">
                仅支持 Android / iOS 手机和平板。无账号、无 AI、无云同步，永久不支持 LCP/DRM。
              </Text>
            </Card.Content>
          </Card>
        </View>
        <Text variant="labelSmall">YSH 阅读 · 0.1.0 · Readium / NativeWind v5 RC</Text>
      </ScrollView>
    </Shell>
  );
}
