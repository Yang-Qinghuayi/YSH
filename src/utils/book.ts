import { EXTS } from '@/libs/document';
import type { Book, BookConfig } from '@/types/book';

import { getUserLang, isContentURI, isValidURL, makeSafeFilename } from './misc';

export const getDir = (book: Book) => {
  return `${book.hash}`;
};
export const getLibraryFilename = () => {
  return 'library.json';
};
export const getLocalBookFilename = (book: Book) => {
  return `${book.hash}/${makeSafeFilename(book.title)}.${EXTS[book.format]}`;
};
export const getCoverFilename = (book: Book) => {
  return `${book.hash}/cover.png`;
};
export const getConfigFilename = (book: Book) => {
  return `${book.hash}/config.json`;
};
export const getFilename = (fileOrUri: string) => {
  if (isValidURL(fileOrUri) || isContentURI(fileOrUri)) {
    fileOrUri = decodeURI(fileOrUri);
  }
  const normalizedPath = fileOrUri.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  const lastPart = parts.pop()!;
  return lastPart.split('?')[0]!;
};
export const getBaseFilename = (filename: string) => {
  const normalizedPath = filename.replace(/\\/g, '/');
  const baseName = normalizedPath.split('/').pop()?.split('.').slice(0, -1).join('.') || '';
  return baseName;
};
export const INIT_BOOK_CONFIG: BookConfig = {
  updatedAt: 0,
};

export type LanguageMap = Record<string, string>;

export interface Contributor {
  name: LanguageMap;
}

const formatLanguageMap = (x: string | LanguageMap): string => {
  const userLang = getUserLang();
  if (!x) return '';
  if (typeof x === 'string') return x;
  const keys = Object.keys(x);
  return x[userLang] || x[keys[0]!]!;
};

export const listFormater = (narrow = false, lang = '') => {
  lang = lang ? lang : getUserLang();
  if (narrow) {
    return new Intl.ListFormat('en', { style: 'narrow', type: 'unit' });
  } else {
    return new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' });
  }
};

export const getBookLangCode = (lang: string | string[] | undefined) => {
  try {
    const bookLang = typeof lang === 'string' ? lang : lang?.[0];
    return bookLang ? bookLang.split('-')[0]! : '';
  } catch {
    return '';
  }
};

export const formatAuthors = (
  contributors: string | Contributor | [string | Contributor],
  bookLang?: string | string[]
) => {
  const langCode = getBookLangCode(bookLang) || 'en';
  return Array.isArray(contributors)
    ? listFormater(langCode === 'zh', langCode).format(
        contributors.map((contributor) =>
          typeof contributor === 'string' ? contributor : formatLanguageMap(contributor?.name)
        )
      )
    : typeof contributors === 'string'
      ? contributors
      : formatLanguageMap(contributors?.name);
};
export const formatTitle = (title: string | LanguageMap) => {
  return typeof title === 'string' ? title : formatLanguageMap(title);
};

export const getPrimaryLanguage = (lang: string | string[] | undefined) => {
  return Array.isArray(lang) ? lang[0] : lang;
};

export const formatDate = (date: string | number | Date | null | undefined) => {
  if (!date) return;
  const userLang = getUserLang();
  try {
    return new Date(date).toLocaleDateString(userLang, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return;
  }
};
