<template>
  <div @contextmenu="addBooks" class="h-[88vh]">
    <div class="mt-2">
      <card-row>
        <v-card
          @click.right.native="(event) => deleteBook(event, file.name)"
          @click="goToRead(file)"
          v-for="file in epubFiles"
          :flat="true"
        >
          <v-img
            class="cover-image"
            :cover="true"
            :src="file.cover"
            style="aspect-ratio: 1"
            :aspect-ratio="1"
            :lazy-src="placeholderUrl"
          >
          </v-img>
          <!-- 名称 -->
          <v-card-title :class="[lgAndUp ? '' : 'text-sm']">
            {{ file.name }}
          </v-card-title>
        </v-card>
      </card-row>
    </div>
    <input
      ref="dirInput"
      type="file"
      @change="handleDirChange"
      class="hidden"
      webkitdirectory
    />
    <input
      ref="fileInput"
      type="file"
      @change="handleFileChange"
      class="hidden"
    />
  </div>
</template>

<script setup>
import { useDisplay } from "vuetify";
const display = useDisplay();
const { lgAndUp } = display;

function handleFileChange(event) {
  let file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    const book = EPub(e.target.result);
    // 获取封面
    const cover = await book.loaded.cover;
    const coverBlob = await book.archive.getBlob(cover);
    const coverUrl = URL.createObjectURL(coverBlob);
    const metadata = await book.loaded.metadata;
    const bookName = metadata.title.replace(/\(.*?\) |（.*?）/g, "");
    await localForage.setItem(bookName, {
      book: e.target.result,
      name: bookName,
      cover: coverBlob,
    });
    epubFiles.value.push({ name: bookName, cover: coverUrl });
  };
  reader.readAsArrayBuffer(file);
}

function handleDirChange(event) {
  epubFiles.value = [];
  let files = Array.from(event.target.files);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const book = EPub(e.target.result);
      let cover = await book.loaded.cover;
      let coverBlob = await book.archive.getBlob(cover);
      const coverUrl = URL.createObjectURL(coverBlob);
      let metadata = await book.loaded.metadata;
      let bookName = metadata.title.replace(/\(.*?\) |（.*?）/g, "");
      await localForage.setItem(bookName, {
        book: e.target.result,
        name: bookName,
        cover: coverBlob,
      });
      epubFiles.value.push({ name: bookName, cover: coverUrl });
    };
    reader.readAsArrayBuffer(file);
  });
}

const fileInput = ref(null);

const dirInput = ref(null);

function addBooks(event) {
  // 劫持系统默认行为
  event.preventDefault();
  const { x, y } = event;
  const option = {
    theme: themeName.value,
    x,
    y,
    items: [
      {
        label: "导入书籍",
        onClick: () => {
          fileInput.value.click();
        },
      },
      {
        label: "导入书架",
        onClick: async () => {
          dirInput.value.click();
        },
      },
      {
        divided: true,
      },
    ],
    offsetFooter: 64,
    customClass: "bg-surfaceVariant",
  };
  contextMenu(option);
}

// 移除书架
import { useContextMenu } from "vuetify-ctx-menu/lib/main";
const contextMenu = useContextMenu();
const { themeName } = useCurrentTheme();

function deleteBook(event, name) {
  event.stopPropagation(); // 阻止事件冒泡
  event.preventDefault();
  let option;
  const { x, y } = event;
  option = {
    theme: themeName.value,
    x,
    y,
    items: [
      {
        label: "从书架移除",
        onClick: () => {
          removeFromBookshelves(name);
        },
      },
    ],
    offsetFooter: 64,
    customClass: "bg-surfaceVariant",
  };
  contextMenu(option);
}
import { useToast } from "vue-toastification";
const toast = useToast();
function removeFromBookshelves(name) {
  try {
    localForage.removeItem(name);
    epubFiles.value = epubFiles.value.filter((file) => file.name !== name);
    toast.success("已从书架移除");
  } catch (e) {
    toast.error("移除失败");
  }
}
const router = useRouter();
const goToRead = async (file) => {
  const bookInForage = await localForage.getItem(file.name);
  const book = EPub(bookInForage.book);
  bookStore.SET_BOOK(book);
  router.push("/book");
};

import placeholderUrl from "@/assets/placeholder.png";

import { ref } from "vue";
import { useBookStore } from "@/store/book";
const bookStore = useBookStore();
import EPub from "epubjs";
import localForage from "localforage";
localForage.config({
  name: "epubBooks",
});
const epubFiles = ref([]);

// 解析封面,顺便也得到book对象
const parseCover = async (books) => {
  let rst = [];
  for (const { name, cover } of books) {
    const url = URL.createObjectURL(cover);
    rst.push({ name, cover: url });
  }
  return rst;
};

// 获取书架中的书
const bookNames = [...(await localForage.keys())].filter((name) => {
  return name.split("*").length === 1;
});

const books = await Promise.all(
  bookNames.map(async (name) => {
    return await localForage.getItem(name);
  })
);
if (books) {
  epubFiles.value = await parseCover(books);
}
</script>
