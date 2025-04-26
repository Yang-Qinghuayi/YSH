<template>
  <div class="h-[88vh]">
    <v-btn variant="tonal" color="primary" @click="fileInput?.click()">
      上传书籍
    </v-btn>
    <v-btn variant="tonal" class="ml-3" color="primary" @click="dirInput?.click()">
      上传文件夹
    </v-btn>
    <div class="mt-2">
      <card-row>
        <v-card @click="goToRead(file)" v-for="file in epubFiles" :flat="true">
          <v-img class="cover-image" :cover="true" :src="file.cover" style="aspect-ratio: 1" :aspect-ratio="1"
            :lazy-src="placeholderUrl">
          </v-img>
          <!-- 名称 -->
          <v-card-title :class="[lgAndUp ? '' : 'text-sm']">
            {{ file.name }}
            <v-menu open-on-hover open-delay=100 close-delay="100">
              <template v-slot:activator="{ props }">
                <v-btn variant="text" color="primary" icon size="small" v-bind="props">
                  <v-icon class="text-[#777c7a]">{{ mdiDotsHorizontal }}</v-icon>
                </v-btn>
              </template>

              <v-list elevation=6 class="p-0">
                <v-list-item class=" px-6 py-4 text-center" v-for="(item, index) in items" :key="index" :value="index"
                  @click="item.function(file.name)">
                  {{ item.title }}
                </v-list-item>
              </v-list>
            </v-menu>
          </v-card-title>
        </v-card>
      </card-row>
    </div>
    <input ref="dirInput" type="file" @change="handleDirChange" class="hidden" webkitdirectory />
    <input ref="fileInput" type="file" @change="handleFileChange" class="hidden" />
  </div>
</template>

<script setup lang="ts">
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


const items = [
  {
    title: '删除', function: (name: string) => {
      removeFromBookshelves(name);
    }
  },
]
//  delete book
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

// goto read
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
import { mdiDotsHorizontal } from "@mdi/js";
localForage.config({
  name: "epubBooks",
});
const epubFiles = ref([]);

getBooks();

async function getBooks() {
  // 解析封面,顺便也得到book对象
  const parseCover = async (books) => {
    const rst = [];
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

}
</script>
