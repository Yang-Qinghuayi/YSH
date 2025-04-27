<template>
  <div>
    <div :class="[lgAndUp ? 'mt-[4vh] h-[90vh]' : 'h-[94vh]']" class="flex justify-center items-center w-full">
      <v-btn v-if="lgAndUp" class="fixed right-5 top-5" icon color="secondary" variant="tonal"
        @click="showBigCatalog = !showBigCatalog">
        <v-icon color="secondary">
          {{ mdiBookOpenVariantOutline }}
        </v-icon>
      </v-btn>

      <div class="w-full h-full" ref="containerRef"></div>

      <!-- 目录部分 -->
      <transition name="fade" enter-active-class="transition ease-out duration-300"
        leave-active-class="transition ease-in duration-300">
        <Directory class="w-[16vw] h-[70vh] mx-[2vw] px-2 py-4 overflow-auto theme-border"
          v-if="lgAndUp && showBigCatalog" />
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import "@/foliate-js/view.js";
import { FoliateView } from "@/types/view"
import { useDisplay } from "vuetify";
const { lgAndUp, } = useDisplay();

import { storeToRefs } from "pinia";
import { useSettingStore } from "@/store/setting";
const { showBigCatalog } = storeToRefs(useSettingStore()) as any

import localforage from "localforage";
localforage.config({
  name: "epubBooks",
});
import { useBookSettingsStore } from "@/store/bookSettings";
const BSstore = useBookSettingsStore() as any

import { useBookStore } from "@/store/book";
import { mdiBookOpenVariantOutline } from "@mdi/js";
const bookStore = useBookStore();

const containerRef = ref<HTMLDivElement | null>(null);
const viewRef = ref<FoliateView | null>(null);


onMounted(async () => {
  const view = document.createElement("foliate-view") as FoliateView
  containerRef.value && containerRef.value.appendChild(view);

  let blob: Blob | null = null
  if (!bookStore.book) {
    const bookInForage = await localforage.getItem(
      BSstore.metadata.title.replace(/\(.*?\) |（.*?）/g, "")
    ) as any
    if (bookInForage) {
      blob = new Blob([bookInForage.book]);
    }
  } else {
    blob = new Blob(bookStore.book)
  }
  blob && await view.open(blob); // 可以替换为 File 对象或实际路径
  viewRef.value = view

  view.goToFraction(0)
});
</script>

<style>
.theme-border {
  border: 3px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 6px;
}
</style>
