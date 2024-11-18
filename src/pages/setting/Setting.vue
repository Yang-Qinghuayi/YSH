<template>
  <section class="d-flex justify-center">
    <div style="max-width: 960px" class="flex mt-6 flex-column gap-4 flex-fill">
      <div>
        <div class="font-bold">听我说</div>
        <div class="py-8 px-2">“口痰可以用作胶水。”</div>
      </div>

      <app-settings-theme />
      <!-- <app-settings-other /> -->
      <v-btn
        class="no-drag-area"
        v-bind="$attrs"
        variant="tonal"
        color="secondary"
        @click.prevent="fileInput.click()"
      >
        导入一本书
      </v-btn>
      <v-btn
        class="no-drag-area"
        v-bind="$attrs"
        variant="tonal"
        color="secondary"
        @click.prevent="dirInput.click()"
      >
        导入许多书
      </v-btn>
      <!-- <app-settings-reset /> -->
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
  </section>
</template>

<script setup>
import AppSettingsTheme from "./components/Theme.vue";
const fileInput = ref(null);
const dirInput = ref(null);
import EPub from "epubjs";
import localForage from "localforage";
localForage.config({
  name: "epubBooks",
});

function handleDirChange(event) {
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
    };
    reader.readAsArrayBuffer(file);
  });
}

function handleFileChange(event) {
  let file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    const book = EPub(e.target.result);
    // 获取封面
    const cover = await book.loaded.cover;
    const coverBlob = await book.archive.getBlob(cover);
    const metadata = await book.loaded.metadata;
    const bookName = metadata.title.replace(/\(.*?\) |（.*?）/g, "");
    await localForage.setItem(bookName, {
      book: e.target.result,
      name: bookName,
      cover: coverBlob,
    });
  };
  reader.readAsArrayBuffer(file);
}
</script>
