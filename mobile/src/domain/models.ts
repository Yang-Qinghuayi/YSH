import type { Locator } from 'react-native-readium';
export type Format = 'epub' | 'pdf';
export interface Book {
  id: string;
  hash: string;
  format: Format;
  title: string;
  author: string;
  fileName: string;
  coverName: string | null;
  createdAt: number;
  lastReadAt: number;
  locator: Locator | null;
  progression: number;
}
export interface Mark {
  id: string;
  bookId: string;
  kind: 'bookmark' | 'highlight';
  locator: Locator;
  text: string;
  note: string;
  color: string;
  createdAt: number;
}
export const PALETTES = [
  { label: '陶土缪斯', seed: '#b86545' },
  { label: '蔷薇晨雾', seed: '#b05279' },
  { label: '鼠尾草诗页', seed: '#5f7f63' },
  { label: '靛蓝夜曲', seed: '#4f5fa8' },
] as const;
export interface Settings {
  mode: 'system' | 'light' | 'dark';
  seed: string;
  fontSize: number;
  lineHeight: number;
  margins: number;
  scroll: boolean;
  fontFamily: 'serif' | 'sans-serif' | 'OpenDyslexic';
  spread: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  mode: 'system',
  seed: '#b86545',
  fontSize: 100,
  lineHeight: 1.6,
  margins: 1,
  scroll: false,
  fontFamily: 'serif',
  spread: true,
};
export function normalizeSeed(value: string): string | null {
  const s = value.trim().toLowerCase();
  if (/^#[\da-f]{6}$/.test(s)) return s;
  if (/^#[\da-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((x) => x + x).join('');
  return null;
}
export function parseSettings(input: unknown): Settings {
  const s = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const bounded = (key: string, min: number, max: number, fallback: number) =>
    typeof s[key] === 'number' && Number.isFinite(s[key])
      ? Math.min(max, Math.max(min, s[key]))
      : fallback;
  return {
    mode: s.mode === 'light' || s.mode === 'dark' ? s.mode : 'system',
    seed:
      typeof s.seed === 'string'
        ? (normalizeSeed(s.seed) ?? DEFAULT_SETTINGS.seed)
        : DEFAULT_SETTINGS.seed,
    fontSize: bounded('fontSize', 100, 240, 100),
    lineHeight: bounded('lineHeight', 1, 2, 1.6),
    margins: bounded('margins', 0.5, 3, 1),
    scroll: typeof s.scroll === 'boolean' ? s.scroll : false,
    fontFamily:
      s.fontFamily === 'sans-serif' || s.fontFamily === 'OpenDyslexic' ? s.fontFamily : 'serif',
    spread: typeof s.spread === 'boolean' ? s.spread : true,
  };
}
export function layoutForWidth(width: number) {
  const expanded = width >= 840;
  return {
    expanded,
    medium: width >= 600,
    columns: Math.max(1, Math.floor((width - (expanded ? 112 : 32)) / 230)),
  };
}
export function progressionOf(locator: Locator): number {
  const n = locator.locations?.totalProgression ?? locator.locations?.progression ?? 0;
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}
