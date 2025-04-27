import { SectionItem, TOCItem, CFI, BookDoc } from '@/libs/document';

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

export const findTocItemBS = (toc: TOCItem[], cfi: string): TOCItem | null => {
  let left = 0;
  let right = toc.length - 1;
  let result: TOCItem | null = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const currentCfi = toc[mid]!.cfi || '';
    const comparison = CFI.compare(currentCfi, cfi);
    if (comparison === 0) {
      return toc[mid]!;
    } else if (comparison < 0) {
      result = toc[mid]!;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
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
  sections: { [id: string]: SectionItem },
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
