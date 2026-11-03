import { Text } from '../src/components/Typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, ScrollView, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  IconButton,
  Portal,
  ProgressBar,
  Searchbar,
} from 'react-native-paper';
import { Shell } from '../src/components/Shell';
import { useApp } from '../src/services/AppProvider';
import {
  fileUri,
  importAsset,
  pickBooks,
  releasePickerCache,
  removeBook,
} from '../src/services/library';
import { layoutForWidth, type Book } from '../src/domain/models';
export default function Library() {
  const { repo, notify } = useApp();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState('');
  const [status, setStatus] = useState('');
  const [fraction, setFraction] = useState(0);
  const [deleting, setDeleting] = useState<Book | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const cancel = useRef<AbortController | null>(null);
  const picking = useRef(false);
  const { columns } = layoutForWidth(useWindowDimensions().width);
  const reload = useCallback(async () => {
    try {
      setBooks(await repo.books());
    } catch (e) {
      notify(`书库读取失败：${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [repo, notify]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );
  useEffect(() => () => cancel.current?.abort(), []);
  async function onImport() {
    if (picking.current || importing) return;
    picking.current = true;
    try {
      const result = await pickBooks();
      if (result.canceled) return;
      const controller = new AbortController();
      cancel.current = controller;
      setImporting(true);
      setFraction(0);
      let added = 0,
        duplicate = 0;
      const errors: string[] = [];
      for (const [index, asset] of result.assets.entries()) {
        if (controller.signal.aborted) break;
        setStatus(`${index + 1}/${result.assets.length} · ${asset.name}`);
        // Allow the progress UI to paint before parsing local bytes on the JS thread.
        await new Promise((resolve) => setTimeout(resolve, 30));
        try {
          const r = await importAsset(repo, asset, controller.signal);
          r.duplicate ? duplicate++ : added++;
        } catch (e) {
          if (!controller.signal.aborted)
            errors.push(`${asset.name}：${e instanceof Error ? e.message : String(e)}`);
        } finally {
          releasePickerCache(asset.uri);
        }
        setFraction((index + 1) / result.assets.length);
      }
      // Release copies for files skipped after cancellation as well.
      for (const asset of result.assets) releasePickerCache(asset.uri);
      await reload();
      setReport(
        `新增 ${added} 本，重复 ${duplicate} 本${controller.signal.aborted ? '，已取消剩余任务' : ''}${errors.length ? '\n\n导入失败：\n' + errors.join('\n\n') : ''}`
      );
    } catch (e) {
      notify(`导入失败：${String(e)}`);
    } finally {
      setImporting(false);
      picking.current = false;
      cancel.current = null;
    }
  }
  async function confirmDelete() {
    if (!deleting || busyDelete) return;
    setBusyDelete(true);
    try {
      await removeBook(repo, deleting);
      setDeleting(null);
      await reload();
    } catch (e) {
      notify(`删除失败：${String(e)}`);
      await reload();
    } finally {
      setBusyDelete(false);
    }
  }
  const filtered = books.filter((b) =>
    `${b.title} ${b.author}`.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <Shell
      title="我的书库"
      action={
        <Button
          icon="plus"
          mode="contained"
          loading={importing}
          disabled={importing || busyDelete}
          onPress={() => void onImport()}
        >
          导入
        </Button>
      }
    >
      <View className="px-5 pb-4">
        <Text className="mb-4 text-on-surface-variant">
          只属于你的阅读空间 · EPUB / PDF · 本地离线
        </Text>
        <Searchbar
          placeholder="搜索标题或作者"
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="搜索书库"
        />
      </View>
      {importing && (
        <View className="gap-2 px-5 pb-3">
          <Text numberOfLines={1}>{status}</Text>
          <ProgressBar progress={fraction} />
          <Button onPress={() => cancel.current?.abort()}>取消剩余导入</Button>
        </View>
      )}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filtered}
          key={columns}
          numColumns={columns}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-4 p-8">
              <Text variant="headlineSmall">{query ? '没有找到书籍' : '从一本好书开始'}</Text>
              <Text className="text-center text-on-surface-variant">
                {query ? '试试其他标题或作者' : '导入自有 EPUB 或 PDF，无需账号，不上传书籍。'}
              </Text>
              {!query && (
                <Button mode="outlined" onPress={() => void onImport()} disabled={importing}>
                  选择书籍
                </Button>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ width: `${100 / columns}%`, padding: 8 }}>
              <Card
                mode="contained"
                onPress={() => router.push({ pathname: '/reader/[id]', params: { id: item.id } })}
                accessibilityLabel={`阅读 ${item.title}`}
              >
                {item.coverName ? (
                  <Image
                    source={{ uri: fileUri(item.coverName) }}
                    style={{ width: '100%', height: 190, resizeMode: 'contain' }}
                    accessibilityLabel={`${item.title}封面`}
                  />
                ) : (
                  <View className="h-44 items-center justify-center rounded-t-xl bg-surface-container">
                    <Text variant="displaySmall">{item.format === 'pdf' ? 'PDF' : '书'}</Text>
                  </View>
                )}
                <Card.Content>
                  <Text variant="titleMedium" numberOfLines={2} style={{ marginTop: 12 }}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} className="mt-1 text-on-surface-variant">
                    {item.author || '未知作者'}
                  </Text>
                  <ProgressBar progress={item.progression} style={{ marginTop: 12 }} />
                  <View className="flex-row items-center justify-between">
                    <Text variant="labelSmall">
                      {item.format.toUpperCase()} · {Math.round(item.progression * 100)}%
                    </Text>
                    <IconButton
                      icon="trash-can-outline"
                      accessibilityLabel={`删除 ${item.title}`}
                      disabled={importing}
                      onPress={() => setDeleting(item)}
                    />
                  </View>
                </Card.Content>
              </Card>
            </View>
          )}
        />
      )}
      <Portal>
        <Dialog
          visible={!!report}
          onDismiss={() => setReport('')}
          style={{ maxWidth: 560, width: '92%', alignSelf: 'center' }}
        >
          <Dialog.Title>导入结果</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
              <Text selectable>{report}</Text>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setReport('')}>完成</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={!!deleting}
          onDismiss={() => !busyDelete && setDeleting(null)}
          style={{ maxWidth: 520, width: '90%', alignSelf: 'center' }}
        >
          <Dialog.Title>从书库删除？</Dialog.Title>
          <Dialog.Content>
            <Text>将删除《{deleting?.title}》的应用副本、阅读进度和批注，不影响原文件。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={busyDelete} onPress={() => setDeleting(null)}>
              取消
            </Button>
            <Button loading={busyDelete} onPress={() => void confirmDelete()}>
              删除
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Shell>
  );
}
