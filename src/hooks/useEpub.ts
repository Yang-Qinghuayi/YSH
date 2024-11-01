import { refreshLocation } from "@/pages/epub/epubUtil";
import Epub from "epubjs";
import type { Book, Rendition } from "epubjs";
import type { BookOptions } from "epubjs/types/book";
import type { RenditionOptions } from "epubjs/types/rendition";
import { useBookStore } from "@/store/book";
import { useBookSettingsStore } from "@/store/bookSettings";
import localforage from "localforage";

export function useEpub() {
  let book: Book;
  let rendition: Rendition;
  const store = useBookStore();
  const bookSettingStore = useBookSettingsStore();

  function createBook(urlOrData?: string | ArrayBuffer, options?: BookOptions) {
    // 判断是否已经存在book对象
    if (store.book) {
      book = store.book;
      return book;
    }

    if (!urlOrData) {
      book = Epub(options);
    } else {
      book = Epub(urlOrData, options);
    }
    store.SET_BOOK(book);
    return book;
  }

  function render(element: Element | string, options?: RenditionOptions) {
    if (!book) return;
    if (typeof element === "string") {
      rendition = book.renderTo(element, options);
    } else {
      rendition = book.renderTo(element, options);
    }
    rendition.themes.font("LXGW WenKai");

    parseBook();
    return rendition;
  }

  async function display() {
    if (!rendition) return;
    const bookInfo: any = await localforage.getItem(
      bookSettingStore.metadata.title + "*Info"
    );
    return rendition.display(bookInfo?.progress);
  }

  function getBook() {
    return book;
  }

  function getRendition() {
    return rendition;
  }
  async function next() {
    await rendition.next();
    refreshLocation();
  }

  async function prev() {
    await rendition.prev();
    refreshLocation();
  }

  function setFontSize(fontSize: number) {
    if (rendition?.themes) {
      rendition.themes.fontSize(fontSize + "px");
    }
  }
  function parseBook() {
    if (!book) return;
    book.loaded.cover.then((cover) => {
      // 获取封面
      book.archive.createUrl(cover, { base64: false }).then((url) => {
        bookSettingStore.SET_COVER(url);
      });
      // 获取元数据信息
      book.loaded.metadata.then((metadata) => {
        bookSettingStore.SET_METADATA(metadata);
      });
      // 获取书籍目录信息
      book.loaded.navigation.then((nav) => {
        // 多维数组扁平化
        const navItem = flatten(nav.toc);
        // 添加目录层级属性
        function find(item, level = 0) {
          return !item.parent
            ? level
            : find(
                navItem.filter(
                  (parentItem: any) => parentItem.id === item.parent
                )[0],
                ++level
              );
        }
        navItem.forEach((item: any) => {
          item.level = find(item);
        });
        bookSettingStore.SET_NAVIGATION(navItem);
      });
    });
    book.ready.then(() => {
      bookSettingStore.SET_BOOKAVAIABLE(true);
      refreshLocation();
    });
  }
  return {
    createBook,
    render,
    display,
    getBook,
    getRendition,
    setFontSize,
    next,
    prev,
  };
}

function flatten(array) {
  return [].concat(
    ...array.map((item) => [].concat(item, ...flatten(item.subitems)))
  );
}
