import { strFromU8, unzipSync } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { Format } from './models';
export const LIMITS = {
  file: 80 * 1024 * 1024,
  expanded: 128 * 1024 * 1024,
  entry: 32 * 1024 * 1024,
  entries: 5000,
};
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export interface PublicationInfo {
  format: Format;
  title: string;
  author: string;
  cover?: Uint8Array;
  coverExtension?: string;
}
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  processEntities: false,
  parseTagValue: false,
});
function xml(bytes: Uint8Array) {
  const s = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(s) || XMLValidator.validate(s) !== true)
    throw new Error('书籍 XML 无效或包含不安全的实体定义');
  return parser.parse(s);
}
function list<T>(x: T | T[] | undefined): T[] {
  return x === undefined ? [] : Array.isArray(x) ? x : [x];
}
function text(x: unknown): string {
  if (typeof x === 'string') return x.trim();
  if (Array.isArray(x)) return x.map(text).filter(Boolean).join('、');
  if (x && typeof x === 'object') return text((x as Record<string, unknown>)['#text']);
  return '';
}
export function safeZipPath(path: string): string {
  if (
    !path ||
    path.includes('\\') ||
    path.includes('\0') ||
    path.startsWith('/') ||
    /^[a-z]+:/i.test(path)
  )
    throw new Error('书籍包含不安全的资源路径');
  const out: string[] = [];
  for (const p of path.split('/')) {
    if (p === '..') {
      if (!out.length) throw new Error('书籍资源路径越界');
      out.pop();
    } else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}
/** ZIP central-directory admission limits before allocating decompressed buffers. */
export function inspectZip(bytes: Uint8Array): Map<string, { size: number; crc: number }> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      v.getUint32(i, true) === 0x06054b50 &&
      i + 22 + v.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('EPUB 压缩目录损坏');
  const count = v.getUint16(end + 10, true);
  let offset = v.getUint32(end + 16, true),
    total = 0;
  const directoryStart = offset;
  if (
    v.getUint16(end + 8, true) !== count ||
    offset + v.getUint32(end + 12, true) !== end ||
    (end >= 20 && v.getUint32(end - 20, true) === 0x07064b50)
  )
    throw new Error('压缩目录不一致或不支持 ZIP64');
  const checked = new Map<string, { size: number; crc: number }>();
  if (
    v.getUint16(end + 4, true) ||
    v.getUint16(end + 6, true) ||
    count === 65535 ||
    count > LIMITS.entries
  )
    throw new Error('不支持分卷、ZIP64 或过多文件的书籍');
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || v.getUint32(offset, true) !== 0x02014b50)
      throw new Error('EPUB 压缩目录损坏');
    const flags = v.getUint16(offset + 8, true),
      packed = v.getUint32(offset + 20, true),
      size = v.getUint32(offset + 24, true);
    const len = v.getUint16(offset + 28, true),
      extra = v.getUint16(offset + 30, true),
      comment = v.getUint16(offset + 32, true);
    if (offset + 46 + len + extra + comment > end) throw new Error('EPUB 压缩目录越界');
    const name = strFromU8(bytes.subarray(offset + 46, offset + 46 + len));
    const canonical = safeZipPath(name);
    if (['__proto__', 'constructor', 'prototype'].includes(canonical))
      throw new Error('书籍包含保留资源名');
    const method = v.getUint16(offset + 10, true),
      local = v.getUint32(offset + 42, true);
    if (
      ![0, 8].includes(method) ||
      local + 30 > directoryStart ||
      v.getUint32(local, true) !== 0x04034b50
    )
      throw new Error('压缩数据头无效');
    const localLength = v.getUint16(local + 26, true),
      localExtra = v.getUint16(local + 28, true);
    if (
      local + 30 + localLength + localExtra + packed > directoryStart ||
      v.getUint16(local + 8, true) !== method ||
      v.getUint16(local + 6, true) !== flags ||
      strFromU8(bytes.subarray(local + 30, local + 30 + localLength)) !== name
    )
      throw new Error('压缩数据与目录不一致');
    if (method === 0 && packed !== size) throw new Error('压缩大小不一致');
    checked.set(name, { size, crc: v.getUint32(offset + 16, true) });
    if (names.has(canonical)) throw new Error('EPUB 包含重复资源路径');
    names.add(canonical);
    total += size;
    if (flags & 1) throw new Error('不支持加密压缩书籍或 DRM');
    if (
      size > LIMITS.entry ||
      total > LIMITS.expanded ||
      (size > 1024 * 1024 && size / Math.max(packed, 1) > 200)
    )
      throw new Error('书籍解压体积或压缩比超过安全限额');
    offset += 46 + len + extra + comment;
  }
  if (offset !== end) throw new Error('压缩目录长度不一致');
  return checked;
}
function assertPassive(name: string, data: Uint8Array) {
  if (!/\.(xhtml|html|htm|svg|css|opf|xml)$/i.test(name)) return;
  if (data.length > 8 * 1024 * 1024) throw new Error('书籍文本资源过大');
  const s = strFromU8(data)
    .replace(/&#(x[\da-f]+|\d+);?/gi, (_, value: string) => {
      const n =
        value[0]?.toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : parseInt(value, 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    })
    .replace(
      /&(colon|Tab|NewLine);/g,
      (_, value: string) => ({ colon: ':', Tab: '\t', NewLine: '\n' })[value]!
    )
    .replace(/\\([\da-f]{1,6})\s?/gi, (_, value: string) =>
      String.fromCodePoint(Math.min(parseInt(value, 16), 0x10ffff))
    );
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(s)) throw new Error('书籍 XML 包含不安全的实体定义');
  if (/<script\b|\bon\w+\s*=|javascript\s*:|<iframe\b|<object\b|<embed\b/i.test(s))
    throw new Error('不支持包含脚本或嵌入程序的 EPUB');
  if (
    /(?:src|href|xlink:href)\s*=\s*["']\s*(?:[a-z][a-z0-9+.-]*:|\/\/)|url\s*\(\s*["']?\s*(?:[a-z][a-z0-9+.-]*:|\/\/)|@import\s+["']\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(
      s
    )
  )
    throw new Error('第一版仅支持自包含 EPUB，请移除外部网络资源或链接');
}
export function inspectPublication(bytes: Uint8Array, filename: string): PublicationInfo {
  if (!bytes.length || bytes.length > LIMITS.file) throw new Error('书籍为空或超过 80 MB 导入上限');
  const fallback = filename.replace(/\.[^.]+$/, '') || '未命名书籍';
  if (strFromU8(bytes.subarray(0, 5)) === '%PDF-') {
    const raw = strFromU8(bytes, true);
    if (/\/Encrypt\b|\/JavaScript\b|\/JS\b|\/Launch\b|\/URI\b/.test(raw))
      throw new Error('不支持加密或含主动动作/外链的 PDF');
    return { format: 'pdf', title: fallback, author: '' };
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    throw new Error('仅支持有效的 EPUB 和 PDF，不支持 LCP/DRM');
  const checked = inspectZip(bytes);
  const entries = unzipSync(bytes, { filter: (f) => f.originalSize <= LIMITS.entry });
  for (const [name, data] of Object.entries(entries)) {
    const expected = checked.get(name);
    if (!expected || data.length !== expected.size || crc32(data) !== expected.crc)
      throw new Error('EPUB 资源校验失败，文件可能损坏');
    assertPassive(name, data);
  }
  if (entries['META-INF/license.lcpl']) throw new Error('永久不支持 LCP 受保护书籍');
  const encryption = entries['META-INF/encryption.xml'];
  if (encryption) {
    const algorithms = [...strFromU8(encryption).matchAll(/Algorithm\s*=\s*["']([^"']+)/gi)].map(
      (x) => x[1]
    );
    if (
      !algorithms.length ||
      algorithms.some(
        (x) =>
          !['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC'].includes(x!)
      )
    )
      throw new Error('不支持 DRM 加密书籍');
  }
  if (strFromU8(entries.mimetype ?? new Uint8Array()).trim() !== 'application/epub+zip')
    throw new Error('文件不是有效 EPUB');
  const container = entries['META-INF/container.xml'];
  if (!container) throw new Error('EPUB 缺少 container.xml');
  const root = list<any>(xml(container)?.container?.rootfiles?.rootfile).find(
    (r) => r['@_media-type'] === 'application/oebps-package+xml'
  );
  const path = safeZipPath(root?.['@_full-path'] ?? '');
  if (!entries[path]) throw new Error('EPUB 缺少 OPF 包描述');
  const pkg = xml(entries[path]!).package;
  if (!pkg?.spine?.itemref || !pkg?.manifest?.item) throw new Error('EPUB 没有可阅读章节');
  const meta = pkg.metadata ?? {},
    manifest = list<any>(pkg.manifest.item);
  const coverId = list<any>(meta.meta).find((m) => m['@_name'] === 'cover')?.['@_content'];
  const coverItem =
    manifest.find((x) =>
      String(x['@_properties'] ?? '')
        .split(/\s+/)
        .includes('cover-image')
    ) ?? manifest.find((x) => x['@_id'] === coverId);
  let cover: Uint8Array | undefined, coverExtension: string | undefined;
  if (coverItem && ['image/jpeg', 'image/png', 'image/webp'].includes(coverItem['@_media-type'])) {
    const base = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    const candidate = entries[safeZipPath(base + decodeURIComponent(coverItem['@_href']))];
    if (candidate && candidate.length <= 5 * 1024 * 1024) {
      cover = candidate;
      coverExtension =
        coverItem['@_media-type'] === 'image/jpeg'
          ? 'jpg'
          : coverItem['@_media-type'].split('/')[1];
    }
  }
  return {
    format: 'epub',
    title: text(meta.title) || fallback,
    author: text(meta.creator),
    cover,
    coverExtension,
  };
}
