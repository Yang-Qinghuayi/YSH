/**
 * 从点击目标里提取「这一段」的纯文本。
 *
 * 这些函数刻意不依赖 Vue / Pinia，方便在 node:test 下用轻量假元素回归测试。
 */

/** 语义明确的段落标签，优先命中 */
const PREFERRED_PARAGRAPH_TAGS = new Set([
  'p',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'dd',
  'dt',
  'figcaption',
  'pre',
  'td',
  'th',
]);

/** 部分 EPUB 只用 div 排版，作为兜底 */
const FALLBACK_PARAGRAPH_TAGS = new Set(['div', 'section', 'article']);

const CONTAINER_TAGS = new Set(['html', 'body']);

/** 防止极端排版下把整章内容当成「一段」复制 */
export const MAX_PARAGRAPH_CHARS = 2000;

/** 规整空白：保留段落内换行，压缩行内空格，去掉首尾空白 */
export const normalizeParagraphText = (raw: string): string =>
  raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/[\t\u00a0 ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
    .slice(0, MAX_PARAGRAPH_CHARS);

export const getParagraphText = (element: HTMLElement | null): string => {
  if (!element) return '';
  // innerText 会保留 <br> 与块级换行；取不到时退回 textContent
  const raw =
    typeof element.innerText === 'string' && element.innerText
      ? element.innerText
      : (element.textContent ?? '');
  return normalizeParagraphText(raw);
};

/**
 * 从点击目标向上找最近的一段文字。
 * 优先 p / li / blockquote / 标题 等语义段落；找不到时用最近的非空 div 兜底。
 * 遇到 html / body 立即停止，避免把整章甚至全书内容当成一段。
 */
export const findParagraphElement = (target: EventTarget | null): HTMLElement | null => {
  let element = target as HTMLElement | null;
  let fallback: HTMLElement | null = null;
  let depth = 0;

  while (element && depth < 20) {
    const tag = (element.tagName ?? '').toLowerCase();
    const text = getParagraphText(element);

    if (text && PREFERRED_PARAGRAPH_TAGS.has(tag)) return element;
    if (text && !fallback && FALLBACK_PARAGRAPH_TAGS.has(tag)) fallback = element;
    if (CONTAINER_TAGS.has(tag)) break;

    element = element.parentElement as HTMLElement | null;
    depth += 1;
  }

  return fallback;
};
