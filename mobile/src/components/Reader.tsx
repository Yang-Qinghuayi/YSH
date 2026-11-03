import { Text } from './Typography';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, ScrollView, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Divider,
  IconButton,
  List,
  Modal,
  Portal,
  ProgressBar,
  Searchbar,
  SegmentedButtons,
  Switch,
  TextInput,
} from 'react-native-paper';
import {
  ReadiumView,
  type ReadiumViewRef,
  type Locator,
  type PublicationReadyEvent,
  type Capabilities,
  type Link,
  type DecorationGroup,
} from 'react-native-readium';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../services/AppProvider';
import { fileUri } from '../services/library';
import { createProgressWriter } from '../services/progress';
import { layoutForWidth, progressionOf, type Book, type Mark } from '../domain/models';
import { usePublicationSearch } from '../services/usePublicationSearch';
import { readerPreferences } from '../domain/readerPreferences';

type Panel = 'toc' | 'marks' | 'search' | 'settings';
function flattenToc(links: Link[], depth = 0): { link: Link; depth: number }[] {
  return links.flatMap((link) => [{ link, depth }, ...flattenToc(link.children ?? [], depth + 1)]);
}
const markId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export function Reader({ book }: { book: Book }) {
  const { repo, settings, updateSettings, colors, dark, notify } = useApp();
  const router = useRouter();
  const expanded = layoutForWidth(useWindowDimensions().width).expanded;
  const native = useRef<ReadiumViewRef>(null);
  const [publication, setPublication] = useState<PublicationReadyEvent>();
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [locator, setLocator] = useState<Locator | null>(book.locator);
  const current = useRef<Locator | null>(book.locator);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [editing, setEditing] = useState<Mark | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState('');
  const [query, setQuery] = useState('');
  const search = usePublicationSearch(native);
  const writer = useMemo(
    () =>
      createProgressWriter<Locator>(
        (l) => repo.progress(book.id, l),
        () => notify('阅读位置保存失败，请检查存储空间')
      ),
    [repo, book.id, notify]
  );
  useFocusEffect(
    useCallback(
      () => () => {
        void writer.flush();
      },
      [writer]
    )
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void writer.flush();
    });
    return () => {
      subscription.remove();
      void writer.flush();
    };
  }, [writer]);
  const reloadMarks = useCallback(async () => {
    setMarks(await repo.marks(book.id));
  }, [repo, book.id]);
  useEffect(() => {
    void reloadMarks().catch((e) => notify(`批注读取失败：${String(e)}`));
  }, [reloadMarks, notify]);
  const file = useMemo(
    () => ({ url: fileUri(book.fileName), initialLocation: current.current ?? undefined }),
    [book.fileName, attempt]
  );
  const preferences = useMemo(
    () => readerPreferences(settings, colors, dark, book.format, expanded),
    [settings, colors, dark, book.format, expanded]
  );
  const decorations = useMemo<DecorationGroup[]>(
    () => [
      {
        name: 'highlights',
        decorations: marks
          .filter((m) => m.kind === 'highlight')
          .map((m) => ({
            id: m.id,
            locator: m.locator,
            style: { type: 'highlight', tint: m.color },
            extras: { note: m.note },
          })),
      },
    ],
    [marks]
  );
  const toc = useMemo(() => flattenToc(publication?.tableOfContents ?? []), [publication]);
  useEffect(() => {
    if (publication || error) return;
    const timer = setTimeout(() => setError('打开超时，请重试或检查书籍是否损坏'), 30000);
    return () => clearTimeout(timer);
  }, [publication, error, attempt]);
  const ready = !!publication && !error;
  const positions = publication?.positions ?? [];
  const percent = locator ? progressionOf(locator) : book.progression;
  function goTo(target: Locator) {
    native.current?.goTo(target);
    if (!expanded) setPanel(null);
  }
  function jump() {
    const index = Number(page) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= positions.length) {
      notify(`请输入 1–${positions.length} 之间的位置`);
      return;
    }
    goTo(positions[index]!);
  }
  async function persistMark(mark: Mark) {
    setSaving(true);
    try {
      await repo.saveMark(mark);
      await reloadMarks();
      setEditing(null);
      notify(mark.kind === 'bookmark' ? '书签已保存' : '高亮与笔记已保存');
    } catch (e) {
      notify(`保存失败：${String(e)}`);
    } finally {
      setSaving(false);
    }
  }
  async function bookmark() {
    if (!current.current) return;
    const l = current.current;
    const existing = marks.find(
      (m) => m.kind === 'bookmark' && JSON.stringify(m.locator) === JSON.stringify(l)
    );
    if (existing) {
      notify('当前位置已有书签');
      return;
    }
    await persistMark({
      id: markId(),
      bookId: book.id,
      kind: 'bookmark',
      locator: l,
      text: l.title || `阅读位置 ${Math.round(progressionOf(l) * 100)}%`,
      note: '',
      color: colors.primary,
      createdAt: Date.now(),
    });
  }
  async function deleteMark(mark: Mark) {
    setSaving(true);
    try {
      await repo.deleteMark(mark.id);
      await reloadMarks();
      setEditing(null);
    } catch (e) {
      notify(`删除批注失败：${String(e)}`);
    } finally {
      setSaving(false);
    }
  }
  function onReady(event: PublicationReadyEvent) {
    if (event.isProtected) {
      setError('永久不支持 LCP/DRM 受保护书籍');
      return;
    }
    setPublication(event);
    setCapabilities(event.capabilities);
    const title = event.metadata.title || book.title;
    const author = event.metadata.author?.map((a) => a.name).join('、') || book.author;
    void repo.metadata(book.id, title, author).catch(() => notify('书籍元数据保存失败'));
    void repo.touch(book.id).catch(() => notify('最近阅读时间保存失败'));
  }
  const panelTitle: Record<Panel, string> = {
    toc: '目录与位置',
    marks: '书签与笔记',
    search: '书内搜索',
    settings: '阅读设置',
  };
  const numeric = (
    label: string,
    value: number,
    change: (n: number) => void,
    min: number,
    max: number,
    step: number,
    enabled: boolean
  ) => (
    <View className="flex-row items-center justify-between" key={label}>
      <Text>{label}</Text>
      <View className="flex-row items-center">
        <IconButton
          icon="minus"
          accessibilityLabel={`减小${label}`}
          disabled={!enabled || value <= min}
          onPress={() => change(Math.max(min, Number((value - step).toFixed(2))))}
        />
        <Text>{Number(value.toFixed(2))}</Text>
        <IconButton
          icon="plus"
          accessibilityLabel={`增大${label}`}
          disabled={!enabled || value >= max}
          onPress={() => change(Math.min(max, Number((value + step).toFixed(2))))}
        />
      </View>
    </View>
  );
  const content = () => {
    if (panel === 'toc')
      return (
        <FlatList
          data={toc}
          keyExtractor={(x, index) => `${x.link.href}-${index}`}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View className="gap-3 p-4">
              <Text variant="titleMedium">{publication?.metadata.title || book.title}</Text>
              <Text>
                {publication?.metadata.author?.map((x) => x.name).join('、') ||
                  book.author ||
                  '未知作者'}{' '}
                · {book.format.toUpperCase()}
              </Text>
              {!!positions.length && (
                <>
                  <Text>
                    位置 {locator?.locations?.position ?? '—'} / {positions.length}
                    {book.format === 'epub' ? '（不等同于排版页数）' : ''}
                  </Text>
                  <TextInput
                    label="跳转位置"
                    keyboardType="number-pad"
                    value={page}
                    onChangeText={setPage}
                    onSubmitEditing={jump}
                    right={<TextInput.Icon icon="arrow-right" onPress={jump} />}
                  />
                </>
              )}
            </View>
          }
          ListEmptyComponent={
            <Text style={{ padding: 20 }}>这本书未提供目录，可使用翻页或位置跳转。</Text>
          }
          renderItem={({ item }) => (
            <List.Item
              title={item.link.title || '未命名章节'}
              titleNumberOfLines={2}
              style={{ paddingLeft: 12 + Math.min(item.depth, 5) * 14 }}
              onPress={() =>
                goTo({
                  href: item.link.href,
                  type:
                    item.link.type ||
                    (book.format === 'pdf' ? 'application/pdf' : 'application/xhtml+xml'),
                  title: item.link.title,
                })
              }
            />
          )}
        />
      );
    if (panel === 'marks')
      return (
        <FlatList
          data={marks}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={
            <View className="p-4">
              <Button
                icon="bookmark-plus-outline"
                disabled={!locator || saving}
                mode="outlined"
                onPress={() => void bookmark()}
              >
                添加当前位置书签
              </Button>
            </View>
          }
          ListEmptyComponent={
            <Text style={{ padding: 20 }}>
              尚无书签或笔记。长按正文选择文字后，可添加高亮或笔记。
            </Text>
          }
          renderItem={({ item }) => (
            <View>
              <List.Item
                title={item.note || item.text || '书签'}
                description={`${item.kind === 'bookmark' ? '书签' : '高亮'} · ${Math.round(progressionOf(item.locator) * 100)}%${item.note ? '\n' + item.text : ''}`}
                titleNumberOfLines={2}
                descriptionNumberOfLines={3}
                onPress={() => goTo(item.locator)}
                left={(p) => (
                  <List.Icon
                    {...p}
                    icon={item.kind === 'bookmark' ? 'bookmark-outline' : 'marker'}
                  />
                )}
                right={() => (
                  <IconButton
                    icon="pencil-outline"
                    accessibilityLabel="编辑批注"
                    onPress={() => setEditing({ ...item })}
                  />
                )}
              />
              <Divider />
            </View>
          )}
        />
      );
    if (panel === 'search')
      return (
        <View className="flex-1">
          <View className="gap-2 p-3">
            <Searchbar
              placeholder="输入关键词"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search.run(query)}
              loading={search.busy}
              accessibilityLabel="书内搜索"
            />
            <View className="flex-row gap-2">
              <Button
                disabled={!query.trim() || !capabilities?.search || search.busy}
                onPress={() => void search.run(query)}
              >
                搜索
              </Button>
              <Button
                onPress={() => {
                  search.clear();
                  setQuery('');
                }}
              >
                清除/取消
              </Button>
            </View>
            {!capabilities?.search && (
              <Text>当前格式或出版物未提供全文搜索能力（扫描 PDF 可能没有文字层）。</Text>
            )}
            {!!search.error && <Text>{search.error}</Text>}
          </View>
          <FlatList
            data={search.results}
            keyExtractor={(_, index) => String(index)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={{ padding: 20 }}>
                {search.busy
                  ? '正在搜索…'
                  : search.searched
                    ? '没有搜索结果'
                    : '搜索结果将在这里显示'}
              </Text>
            }
            renderItem={({ item }) => (
              <List.Item
                title={item.highlight || item.locator.text?.highlight || '搜索结果'}
                description={`${item.before ?? ''}${item.highlight ?? ''}${item.after ?? ''}`}
                titleNumberOfLines={2}
                descriptionNumberOfLines={3}
                onPress={() => goTo(item.locator)}
              />
            )}
            ListFooterComponent={
              search.hasMore ? (
                <Button
                  loading={search.busy}
                  disabled={search.busy}
                  onPress={() => void search.more()}
                >
                  加载更多结果
                </Button>
              ) : null
            }
          />
        </View>
      );
    return (
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="titleMedium">全局主题</Text>
        <SegmentedButtons
          value={settings.mode}
          onValueChange={(mode) => updateSettings({ mode: mode as typeof settings.mode })}
          buttons={[
            { value: 'system', label: '系统' },
            { value: 'light', label: '浅' },
            { value: 'dark', label: '深' },
          ]}
        />
        <Text className="text-on-surface-variant">更多种子色可在书库的设置页选择。</Text>
        <Divider />
        {book.format === 'pdf' ? (
          <Text>
            PDF
            使用固定版面，支持原生手势缩放与滚动；字号和行高不适用。搜索、批注由当前原生能力决定。
          </Text>
        ) : (
          <>
            {numeric(
              '字号 %',
              settings.fontSize,
              (fontSize) => updateSettings({ fontSize }),
              100,
              240,
              10,
              !!capabilities?.fontSize
            )}
            {numeric(
              '行高',
              settings.lineHeight,
              (lineHeight) => updateSettings({ lineHeight }),
              1,
              2,
              0.1,
              !!capabilities?.lineHeight
            )}
            {numeric(
              '边距',
              settings.margins,
              (margins) => updateSettings({ margins }),
              0.5,
              3,
              0.25,
              !!capabilities?.pageMargins
            )}
            <SegmentedButtons
              value={settings.fontFamily}
              onValueChange={(fontFamily) =>
                updateSettings({ fontFamily: fontFamily as typeof settings.fontFamily })
              }
              buttons={[
                { value: 'serif', label: '衬线', disabled: !capabilities?.fontFamily },
                { value: 'sans-serif', label: '无衬线', disabled: !capabilities?.fontFamily },
              ]}
            />
            <View className="flex-row items-center justify-between">
              <Text>连续滚动</Text>
              <Switch
                accessibilityLabel="连续滚动"
                value={settings.scroll}
                disabled={!capabilities?.scroll}
                onValueChange={(scroll) => updateSettings({ scroll })}
              />
            </View>
          </>
        )}
        <View className="flex-row items-center justify-between">
          <Text>大屏双页/双列</Text>
          <Switch
            accessibilityLabel="双页或双列"
            value={settings.spread}
            disabled={!capabilities?.spread && !capabilities?.columnCount}
            onValueChange={(spread) => updateSettings({ spread })}
          />
        </View>
        <Text className="text-on-surface-variant">
          仅启用当前出版物声明支持的控件。大屏双页取决于格式、可用宽度和原生阅读器能力。
        </Text>
      </ScrollView>
    );
  };
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <View className="flex-row items-center px-1">
        <IconButton
          icon="arrow-left"
          accessibilityLabel="返回书库"
          onPress={() => {
            void writer
              .flush()
              .then(() => (router.canGoBack() ? router.back() : router.replace('/')));
          }}
        />
        <Text numberOfLines={1} variant="titleMedium" style={{ flex: 1 }}>
          {publication?.metadata.title || book.title}
        </Text>
        <IconButton
          icon="bookmark-plus-outline"
          accessibilityLabel="添加书签"
          disabled={!ready || !locator || saving}
          onPress={() => void bookmark()}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingBottom: 6,
          gap: 4,
          alignItems: 'center',
        }}
        style={{ flexGrow: 0 }}
      >
        {(['toc', 'marks', 'search', 'settings'] as Panel[]).map((p) => (
          <Button
            key={p}
            disabled={!ready}
            mode={panel === p ? 'contained-tonal' : 'text'}
            onPress={() => setPanel(panel === p ? null : p)}
          >
            {panelTitle[p]}
          </Button>
        ))}
      </ScrollView>
      <View className="flex-1 flex-row">
        {/* Keep the native reader at a stable tree position across rotations/breakpoints. */}
        <View
          style={{
            width: expanded && panel ? 320 : 0,
            display: expanded && panel ? 'flex' : 'none',
            backgroundColor: colors.surfaceContainer,
          }}
        >
          <View className="flex-row items-center justify-between px-4">
            <Text variant="titleMedium">{panel ? panelTitle[panel] : ''}</Text>
            <IconButton icon="close" accessibilityLabel="关闭侧栏" onPress={() => setPanel(null)} />
          </View>
          {expanded && panel && content()}
        </View>
        <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.background }}>
          {error ? (
            <View className="flex-1 items-center justify-center gap-4 p-6">
              <Text>{error}</Text>
              <Button
                mode="contained"
                onPress={() => {
                  setPublication(undefined);
                  setCapabilities(undefined);
                  setError('');
                  search.clear();
                  setAttempt((x) => x + 1);
                }}
              >
                重新打开
              </Button>
              <Button onPress={() => router.replace('/')}>返回书库</Button>
            </View>
          ) : (
            <View style={{ flex: 1, width: '100%', maxWidth: expanded ? 1400 : undefined }}>
              <ReadiumView
                key={attempt}
                ref={native}
                file={file}
                preferences={preferences}
                decorations={capabilities?.decorations ? decorations : []}
                onPublicationReady={onReady}
                onPreferencesChanged={(event) => setCapabilities(event.capabilities)}
                onLocationChange={(l) => {
                  current.current = l;
                  setLocator(l);
                  writer.push(l);
                }}
                onPublicationError={(e) => {
                  if (e.stage === 'open') setError(e.message);
                  else notify(`部分内容加载失败：${e.message}`);
                }}
                selectionActions={[
                  { id: 'copy', label: '复制' },
                  ...(capabilities?.decorations
                    ? [
                        { id: 'highlight', label: '高亮' },
                        { id: 'note', label: '笔记' },
                      ]
                    : []),
                ]}
                onSelectionAction={(event) => {
                  if (event.actionId === 'copy') {
                    void Clipboard.setStringAsync(event.selectedText)
                      .then(() => notify('已复制'))
                      .catch(() => notify('复制失败'));
                    return;
                  }
                  if (!capabilities?.decorations) return;
                  const mark: Mark = {
                    id: markId(),
                    bookId: book.id,
                    kind: 'highlight',
                    locator: event.locator,
                    text: event.selectedText,
                    note: '',
                    color: '#f6c95d',
                    createdAt: Date.now(),
                  };
                  if (event.actionId === 'note') setEditing(mark);
                  else void persistMark(mark);
                }}
                onDecorationActivated={(event) => {
                  const mark = marks.find((m) => m.id === event.decoration.id);
                  if (mark) setEditing({ ...mark });
                }}
              />
              {!publication && (
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16,
                    backgroundColor: colors.background,
                  }}
                >
                  <ActivityIndicator />
                  <Text>正在打开 {book.format.toUpperCase()}…</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
      <ProgressBar progress={percent} />
      <View className="flex-row items-center justify-between px-3">
        <IconButton
          icon="chevron-left"
          accessibilityLabel="上一页"
          disabled={!ready}
          onPress={() => native.current?.goBackward()}
        />
        <Text variant="labelMedium">
          {Math.round(percent * 100)}%
          {locator?.locations?.position ? ` · 位置 ${locator.locations.position}` : ''}
        </Text>
        <IconButton
          icon="chevron-right"
          accessibilityLabel="下一页"
          disabled={!ready}
          onPress={() => native.current?.goForward()}
        />
      </View>
      <Portal>
        <Modal
          visible={!expanded && !!panel}
          onDismiss={() => setPanel(null)}
          contentContainerStyle={{
            height: '85%',
            width: '94%',
            maxWidth: 600,
            alignSelf: 'center',
            borderRadius: 20,
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
          <View className="flex-row items-center justify-between px-4">
            <Text variant="titleLarge">{panel ? panelTitle[panel] : ''}</Text>
            <IconButton icon="close" accessibilityLabel="关闭面板" onPress={() => setPanel(null)} />
          </View>
          {!expanded && panel && content()}
        </Modal>
        <Dialog
          visible={!!editing}
          onDismiss={() => !saving && setEditing(null)}
          style={{ maxWidth: 560, width: '92%', alignSelf: 'center' }}
        >
          <Dialog.Title>{editing?.kind === 'bookmark' ? '编辑书签' : '高亮与笔记'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingVertical: 16, gap: 16 }}
            >
              <Text numberOfLines={6}>{editing?.text}</Text>
              <TextInput
                label="笔记"
                multiline
                value={editing?.note ?? ''}
                onChangeText={(note) => setEditing((old) => (old ? { ...old, note } : null))}
                maxLength={20000}
              />
              {editing?.kind === 'highlight' && (
                <View className="flex-row justify-around">
                  {['#f6c95d', '#91cca0', '#97bfee', '#d6a4dc'].map((color) => (
                    <IconButton
                      key={color}
                      icon={editing.color === color ? 'check-circle' : 'circle'}
                      iconColor={color}
                      accessibilityLabel={`高亮颜色 ${color}`}
                      onPress={() => setEditing((old) => (old ? { ...old, color } : null))}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button disabled={saving} onPress={() => editing && void deleteMark(editing)}>
              删除
            </Button>
            <Button disabled={saving} onPress={() => setEditing(null)}>
              取消
            </Button>
            <Button
              loading={saving}
              disabled={saving}
              onPress={() => editing && void persistMark(editing)}
            >
              保存
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}
