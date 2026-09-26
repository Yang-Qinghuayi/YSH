import type { BookDoc, SectionItem, TOCItem } from '@/libs/document';

export const findParentPath = (toc: TOCItem[], href: string): TOCItem[] => {
  for (const item of toc) {
    if (item.href === href) {
      return [item];
    }
    if (item.subitems) {
      const path = findParentPath(item.subitems, href);
      if (path.length) {
        return [item, ...path];
      }
    }
  }
  return [];
};

export const updateTocID = (items: TOCItem[], index = 0): number => {
  items.forEach((item) => {
    item.id ??= index++;
    if (item.subitems) {
      index = updateTocID(item.subitems, index);
    }
  });
  return index;
};

export const updateTocCFI = (
  bookDoc: BookDoc,
  items: TOCItem[],
  sections: Record<string, SectionItem>
): void => {
  items.forEach((item) => {
    if (item.href) {
      const id = bookDoc.splitTOCHref(item.href)[0]!;
      const section = sections[id];
      if (section) {
        item.cfi = section.cfi;
      }
    }
    if (item.subitems) {
      updateTocCFI(bookDoc, item.subitems, sections);
    }
  });
};
