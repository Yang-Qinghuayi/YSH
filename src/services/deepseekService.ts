/**
 * deepseekService.ts
 * DeepSeek API 封装（兼容 OpenAI 格式）
 * 负责构建小说写作 prompt 并流式调用 AI 生成
 */

import OpenAI from 'openai'
import type { Novel, Mention, AIGenerateParams } from '@/types/novel'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
// 发给 AI 的前文上下文最大字符数
const MAX_CONTEXT_CHARS = 2000
// 默认最大生成 token 数
const DEFAULT_MAX_TOKENS = 600

/** 解析编辑器文本中的 @提及 */
export function parseMentions(text: string, novel: Novel): Mention[] {
  const mentions: Mention[] = []
  // 匹配 @角色名.技能名 或 @剧情技能名
  const pattern = /@([一-龥\w]+)(?:\.([一-龥\w]+))?/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const [raw, name, skillName] = match

    // 先找角色
    const character = novel.characters.find((c) => c.name === name)
    if (character) {
      if (skillName) {
        // @角色名.技能名
        const skill = character.skills.find((s) => s.name === skillName)
        if (skill) {
          mentions.push({ type: 'character-skill', raw, characterName: name, skillName, skill, character })
        }
      } else {
        // 只有 @角色名（没有技能），算作角色级别提及，携带所有技能
        mentions.push({ type: 'character-skill', raw, characterName: name, character })
      }
      continue
    }

    // 再找剧情技能
    const plotSkill = novel.plotSkills.find((s) => s.name === name)
    if (plotSkill) {
      mentions.push({ type: 'plot-skill', raw, skillName: name, skill: plotSkill })
    }
  }

  return mentions
}

/** 构建系统 Prompt */
function buildSystemPrompt(novel: Novel, mentions: Mention[], loreContextText?: string): string {
  const lines: string[] = [
    '你是一位专业的中文小说写作助手，擅长根据角色技能和剧情技能风格要求撰写高质量的叙事片段。',
    '',
    `【小说简介】`,
    novel.synopsis || '（无简介）',
    '',
  ]

  // 收集涉及的角色
  const usedCharacterIds = new Set<string>()
  for (const m of mentions) {
    if (m.character) usedCharacterIds.add(m.character.id)
  }
  const usedCharacters = novel.characters.filter((c) => usedCharacterIds.has(c.id))

  if (usedCharacters.length > 0) {
    lines.push('【涉及角色】')
    for (const c of usedCharacters) {
      lines.push(`- ${c.name}：${c.profile}`)
    }
    lines.push('')
  }

  // 收集技能指导
  const skillLines: string[] = []
  for (const m of mentions) {
    if (m.type === 'character-skill' && m.skill && 'prompt' in m.skill) {
      const label = m.skillName ? `${m.characterName}.${m.skillName}` : m.characterName || ''
      skillLines.push(`- 技能「${label}」：${(m.skill as { prompt: string }).prompt}`)
    } else if (m.type === 'plot-skill' && m.skill && 'prompt' in m.skill) {
      skillLines.push(`- 剧情技能「${m.skillName}」：${(m.skill as { prompt: string }).prompt}`)
    }
  }

  if (skillLines.length > 0) {
    lines.push('【本次调用的技能指导】')
    lines.push(...skillLines)
    lines.push('')
  }

  // 注入 Lore 资料库上下文（如有）
  if (loreContextText && loreContextText.trim()) {
    lines.push('')
    lines.push(loreContextText)
  }

  lines.push('【写作要求】')
  lines.push('1. 只输出小说正文，不要输出任何 @提及 标记、说明文字或标题')
  lines.push('2. 自然衔接前文，风格保持一致')
  lines.push('3. 字数控制在 200–500 字')

  return lines.join('\n')
}

/** 构建用户 Prompt（上下文 + 指令） */
function buildUserPrompt(params: AIGenerateParams): string {
  const { chapterContent, cursorPosition, chapter } = params

  // 取光标前 MAX_CONTEXT_CHARS 字符作为前文（去掉 @提及行）
  const textBefore = chapterContent.slice(0, cursorPosition)
  const lines = textBefore.split('\n').filter((l) => !l.trim().startsWith('@'))
  const contextText = lines.join('\n').slice(-MAX_CONTEXT_CHARS)

  return [
    `【当前章节：${chapter.title}】`,
    '',
    '【前文上下文（最近约2000字）】',
    contextText || '（章节开头，无前文）',
    '',
    '请根据以上技能要求，续写下一段内容：',
  ].join('\n')
}

/** 调用 DeepSeek 流式生成，返回 AsyncIterable<string> */
export async function* generateWithDeepSeek(
  params: AIGenerateParams,
  apiKey: string,
  model: 'deepseek-chat' | 'deepseek-reasoner' = 'deepseek-chat',
  maxTokens: number = DEFAULT_MAX_TOKENS,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!apiKey) {
    throw new Error('请先在设置中配置 DeepSeek API Key')
  }

  const client = new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
    dangerouslyAllowBrowser: true,
  })

  const systemPrompt = buildSystemPrompt(params.novel, params.mentions, params.loreContextText)
  const userPrompt = buildUserPrompt(params)

  const stream = await client.chat.completions.create(
    {
      model,
      max_tokens: maxTokens,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    },
    { signal },
  )

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) yield delta
  }
}
