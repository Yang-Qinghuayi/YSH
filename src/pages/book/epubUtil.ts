import { useBookSettingsStore } from "@/store/bookSettings";
import { useBookStore } from "@/store/book";
import localforageKiss from "localforage";
import { Rendition } from "epubjs";
import { Location } from "epubjs/types/rendition";

export async function refreshLocation() {
  const bookSettingsStore = useBookSettingsStore();
  const bookStore: any = useBookStore();
  const rendition: Rendition = bookStore?.book?.rendition;

  if (rendition) {
    // 设置章节
    // bookSettingsStore.SET_SECTION(currentLocation.start.index);
    // 获取阅读进度 并 保存
    const location: Location = (await rendition?.currentLocation()) as any;
    const startCfi = location?.start?.cfi;
    const progress = bookStore.book.locations.percentageFromCfi(startCfi);
    const bookInfo = bookSettingsStore.metadata?.title + "*Info";

    await localforageKiss.setItem(bookInfo, {
      progress: startCfi,
    });
  }
}
