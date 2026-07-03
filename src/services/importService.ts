/**
 * importService.ts
 * 小说导入服务：把外部小说文本导入为一部完整小说（含章节、角色、lore 设定、简介）。
 *
 * 流程：
 *   1. splitChapters：正则预切分章节（标题 + 正文），不依赖 AI，省 token 且稳定。
 *   2. extractImportMeta：把章节清单 + 每章采样交给 AI，提取人物 / 情节阶段 / 设定条目。
 *   3. persistImport：落盘为一部小说，复用 novelService / loreService 的底层写函数。
 *
 * 为避免批量创建时 Date.now() 同毫秒 id 冲突、减少 IO，落盘阶段自行构造带序号的 id
 * 并一次性写入 meta，而非逐个调用 createChapter / createEntry。
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { createOpenAIClient, streamChatWithTools, type DeepSeekModel } from '@/services/deepseekService'
import {
  createNovel,
  saveNovelMeta,
  saveChapterContent,
} from '@/services/novelService'
import { loadOrCreateLore, saveLoreMeta, saveEntryContent } from '@/services/loreService'
import type { Novel, ChapterMeta, Character } from '@/types/novel'
import type { Lore, EntryMeta, EntryImportance } from '@/types/lore'

// ===================== 类型 =====================

/** 切分出的一章 */
export interface SplitChapter {
  title: string
  content: string
}

/** AI 提取出的人物（导入用，字段比 Character 少 id） */
export interface ImportCharacter {
  name: string
  profile?: string
  aliases?: string[]
  literaryReference?: string
}

/** AI 提取出的设定条目（导入用） */
export interface ImportLoreEntry {
  name: string
  importance: EntryImportance
  briefDescription: string
  keywords: string[]
  content: string
}

/** AI 提取出的整书元数据 */
export interface ImportMeta {
  novelTitle: string
  synopsisBrief: string // 精简版情节 → novel.synopsis
  plotProgress: string // 详细情节阶段 → lore 条目正文
  characters: ImportCharacter[]
  loreEntries: ImportLoreEntry[]
}

/** persistImport 的入参（用户在预览框里可能改过） */
export interface PersistImportParams {
  title: string
  synopsis: string
  chapters: SplitChapter[]
  characters: ImportCharacter[]
  loreEntries: ImportLoreEntry[]
  plotProgress: string
}

// ===================== 1. 章节切分 =====================

// 章节标题行匹配规则（按优先级）：
//   - 第一章 / 第 1 章 / 第十回 / 第二节 / 第三卷 ……（中文数字或阿拉伯数字）
//   - Chapter 1 / CHAPTER I
//   - 纯数字起首的标题行：1、 / 1. / 1 空格
const CHAPTER_TITLE_PATTERNS = [
  /^[\s]*第[\s]*([零一二三四五六七八九十百千万0-9]+)[\s]*(章|回|节|卷|篇)(?![\s\S])/,
  /^[\s]*Chapter[\s]+[\dIVXLCDM]+/i,
  /^[\s]*\d+[、.．\s]/,
]

/** 判断一行是否为章节标题 */
function isChapterTitleLine(line: string): boolean {
  const s = line.trim()
  if (!s) return false
  // 标题行一般较短，避免把正文里的"第一章就这样过去了"误判
  if (s.length > 40) return false
  return CHAPTER_TITLE_PATTERNS.some((re) => re.test(s))
}

/** 从标题行里提取干净的标题文本 */
function cleanTitle(line: string): string {
  return line.trim().replace(/^[\s]+/, '').trim() || '未命名'
}

/** 清洗章节正文：统一换行、去掉行首多余空白 */
function cleanContent(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/[\t ]+$/,''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 正则预切分章节。
 * 兜底：若一个章节标题都没匹配到，按每 ~3000 字机械切分，标题用「第 N 节」。
 */
export function splitChapters(rawText: string): SplitChapter[] {
  if (!rawText || !rawText.trim()) return []

  const lines = rawText.split('\n')

  // 先扫一遍判断是否存在章节标题
  const hasTitle = lines.some(isChapterTitleLine)

  if (!hasTitle) {
    // 机械切分
    const text = rawText.replace(/\r\n/g, '\n')
    const chunkSize = 3000
    const chunks: SplitChapter[] = []
    let i = 0
    let idx = 1
    while (i < text.length) {
      // 尽量在句号/换行处切
      let end = Math.min(i + chunkSize, text.length)
      if (end < text.length) {
        const slice = text.slice(i, end)
        const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'))
        if (lastBreak > chunkSize * 0.5) end = i + lastBreak + 1
      }
      chunks.push({
        title: `第 ${idx} 节`,
        content: cleanContent(text.slice(i, end)),
      })
      i = end
      idx++
    }
    return chunks
  }

  // 按标题行切分
  const chapters: SplitChapter[] = []
  let curTitle = '序章'
  let curBody: string[] = []

  const flush = () => {
    const content = cleanContent(curBody.join('\n'))
    if (content || chapters.length === 0) {
      chapters.push({ title: curTitle, content })
    }
    curBody = []
  }

  for (const line of lines) {
    if (isChapterTitleLine(line)) {
      flush()
      curTitle = cleanTitle(line)
    } else {
      curBody.push(line)
    }
  }
  flush()

  // 去掉开头空的「序章」（若序章无内容且后面有正式章节）
  if (chapters.length > 1 && !chapters[0].content && /序章/.test(chapters[0].title)) {
    chapters.shift()
  }

  return chapters
}

// ===================== 2. AI 提取元数据 =====================

const SAMPLE_PER_CHAPTER = 600 // 每章采样字数
const SAMPLE_TAIL = 400 // 末章尾部补采字数

/** 构造给 AI 的上下文文本（章节清单 + 每章采样） */
function buildExtractionInput(chapters: SplitChapter[]): string {
  const lines: string[] = []
  lines.push(`共 ${chapters.length} 章：`)
  chapters.forEach((ch, i) => {
    lines.push('')
    lines.push(`【第 ${i + 1} 章】${ch.title}`)
    const body = ch.content || ''
    const head = body.slice(0, SAMPLE_PER_CHAPTER)
    let sample = head
    // 末章补尾部
    if (i === chapters.length - 1 && body.length > SAMPLE_PER_CHAPTER + SAMPLE_TAIL) {
      sample = head + '\n……（中略）……\n' + body.slice(-SAMPLE_TAIL)
    } else if (body.length > SAMPLE_PER_CHAPTER) {
      sample = head + '\n……（后略）'
    }
    lines.push(sample)
  })
  return lines.join('\n')
}

const EXTRACTION_SYSTEM_PROMPT = [
  '你是一位专业的中文小说编辑。用户会给你一部小说的章节清单与每章正文采样。',
  '请基于这些内容，提取出结构化信息，用于导入小说创作工具。',
  '',
  '提取要求：',
  '1. novelTitle：推断小说标题（若文本中无明显标题，给出一个贴切的名字）。',
  '2. synopsisBrief：100-200 字的精简故事简介，概括主线与当前进展（将作为小说全局简介）。',
  '3. plotProgress：300-600 字的详细情节阶段梳理，按时间顺序说明故事发展到什么阶段、关键转折（将作为一条设定条目）。',
  '4. characters：登场人物列表。每人包含 name（必填）、profile（角色描述，综合性格/出身/外貌/爱好的自然语言叙事）、aliases（别名/称呼数组）、literaryReference（该角色参考的著名文学/影视形象，如 杨过、李寻欢）。只收录有戏份的角色，不要罗列龙套。',
  '5. loreEntries：值得长期记忆的设定条目（世界观、势力、地点、物品、功法、组织等）。每条包含 name、importance（major/important/minor）、briefDescription（3-5 句索引简介）、keywords（别名/触发词数组）、content（详细设定正文）。',
  '',
  '输出格式必须严格为（不要输出标记外的任何内容）：',
  '<<<IMPORT>>>',
  '{"novelTitle":"","synopsisBrief":"","plotProgress":"","characters":[{"name":"","profile":"","aliases":[],"literaryReference":""}],"loreEntries":[{"name":"","importance":"important","briefDescription":"","keywords":[],"content":""}]}',
  '<<<END>>>',
].join('\n')

/** 从模型输出中解析 <<<IMPORT>>>...<<<END>>> 包裹的 JSON */
function parseImportJson(text: string): ImportMeta {
  const match = text.match(/<<<IMPORT>>>\s*([\s\S]*?)\s*<<<END>>>/)
  const raw = match ? match[1] : text
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    // 容错：尝试截取第一个 { 到最后一个 }
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      obj = JSON.parse(raw.slice(start, end + 1))
    } else {
      throw new Error('AI 返回内容无法解析为 JSON')
    }
  }

  const data = obj as Partial<ImportMeta>
  if (!data || typeof data !== 'object') throw new Error('AI 返回内容格式异常')

  const characters: ImportCharacter[] = Array.isArray(data.characters)
    ? data.characters
        .filter((c) => c && typeof c === 'object' && (c as ImportCharacter).name)
        .map((c) => {
          const ch = c as ImportCharacter
          return {
            name: String(ch.name),
            profile: ch.profile || undefined,
            aliases: Array.isArray(ch.aliases) ? ch.aliases.map(String) : undefined,
            literaryReference: ch.literaryReference || undefined,
          }
        })
    : []

  const loreEntries: ImportLoreEntry[] = Array.isArray(data.loreEntries)
    ? data.loreEntries
        .filter((e) => e && typeof e === 'object' && (e as ImportLoreEntry).name)
        .map((e) => {
          const en = e as ImportLoreEntry
          const importance: EntryImportance =
            en.importance === 'major' || en.importance === 'minor' ? en.importance : 'important'
          return {
            name: String(en.name),
            importance,
            briefDescription: en.briefDescription ? String(en.briefDescription) : '',
            keywords: Array.isArray(en.keywords) ? en.keywords.map(String) : [],
            content: en.content ? String(en.content) : '',
          }
        })
    : []

  return {
    novelTitle: data.novelTitle ? String(data.novelTitle) : '导入的小说',
    synopsisBrief: data.synopsisBrief ? String(data.synopsisBrief) : '',
    plotProgress: data.plotProgress ? String(data.plotProgress) : '',
    characters,
    loreEntries,
  }
}

export interface ExtractCallbacks {
  onStatus?: (text: string) => void
  onTextDelta?: (delta: string) => void
}

/**
 * 调 AI 提取导入元数据。
 * 不传 tools，纯文本生成 + JSON 解析。
 */
export async function extractImportMeta(
  params: { apiKey: string; model: DeepSeekModel; chapters: SplitChapter[]; signal?: AbortSignal },
  callbacks: ExtractCallbacks = {},
): Promise<ImportMeta> {
  const client = createOpenAIClient(params.apiKey)
  const userInput = buildExtractionInput(params.chapters)

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: userInput },
  ]

  callbacks.onStatus?.('正在解析小说结构…')
  let fullText = ''
  let finishReason: string | null = null

  for await (const ev of streamChatWithTools(client, {
    model: params.model,
    messages,
    signal: params.signal,
  })) {
    if (ev.type === 'text') {
      fullText += ev.delta
      callbacks.onTextDelta?.(ev.delta)
    } else if (ev.type === 'done') {
      finishReason = ev.finishReason
    }
  }

  if (params.signal?.aborted) throw new DOMException('已取消', 'AbortError')
  if (!fullText.trim()) {
    throw new Error(`AI 未返回内容（finishReason=${finishReason ?? 'unknown'}）`)
  }

  callbacks.onStatus?.('正在整理结果…')
  return parseImportJson(fullText)
}

// ===================== 3. 落盘 =====================

/** 文件名清洗（与 novelService.createChapter 一致） */
function sanitizeFilename(title: string): string {
  return title.replace(/[/\\?*:|"<>]/g, '_')
}

/**
 * 把导入结果落盘为一部小说。
 * 返回最终 Novel，供 UI 打开。
 */
export async function persistImport(params: PersistImportParams): Promise<Novel> {
  // 1. 创建小说（内部已 saveNovelMeta，得到 novel.id 与时间戳基线）
  const novel = await createNovel(params.title, params.synopsis)
  const ts = novel.id // novel-{timestamp}

  // 2. 批量写章节正文 + 收集 ChapterMeta
  const chapters: ChapterMeta[] = []
  for (let i = 0; i < params.chapters.length; i++) {
    const ch = params.chapters[i]
    const order = i + 1
    const paddedOrder = String(order).padStart(3, '0')
    const filename = `${paddedOrder}_${sanitizeFilename(ch.title)}.md`
    const content = ch.content && ch.content.trim() ? ch.content : ''
    await saveChapterContent(filename, content)
    chapters.push({
      id: `chapter-${ts}-${i}`,
      filename,
      title: ch.title,
      order,
    })
  }

  // 3. 角色：映射成 Character[]
  const characters: Character[] = params.characters.map((c, i) => ({
    id: `char-${ts}-${i}`,
    name: c.name,
    profile: c.profile,
    aliases: c.aliases,
    literaryReference: c.literaryReference,
  }))

  // 4. 一次写回全部章节 meta 和角色
  const novelWithMeta: Novel = {
    ...novel,
    chapters,
    characters,
  }
  await saveNovelMeta(novelWithMeta)

  // 5. Lore：建资料库 + 批量写条目正文 + 一次写 meta
  const lore: Lore = await loadOrCreateLore(novelWithMeta)
  const allEntries: ImportLoreEntry[] = [
    // 情节梗概作为第一条 major 条目
    {
      name: '情节梗概',
      importance: 'major',
      briefDescription: '导入时由 AI 梳理的情节发展阶段。',
      keywords: ['情节', '剧情'],
      content: params.plotProgress,
    },
    ...params.loreEntries,
  ]

  const entryMetas: EntryMeta[] = []
  for (let i = 0; i < allEntries.length; i++) {
    const en = allEntries[i]
    const id = `entry-${ts}-${i}`
    const filename = `${id}.md`
    const body = `# ${en.name}\n\n${en.content || ''}`.trimEnd() + '\n'
    await saveEntryContent(filename, body)
    entryMetas.push({
      id,
      filename,
      name: en.name.trim() || '未命名条目',
      importance: en.importance,
      briefDescription: en.briefDescription,
      keywords: en.keywords,
      enabled: true,
      order: i + 1,
    })
  }

  const loreWithEntries: Lore = {
    ...lore,
    novelTitle: novelWithMeta.title,
    entries: entryMetas,
  }
  await saveLoreMeta(loreWithEntries)

  return novelWithMeta
}
