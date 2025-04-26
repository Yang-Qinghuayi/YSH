<template>
  <div>
    <div :class="[lgAndUp ? 'mt-[4vh] h-[90vh]' : 'h-[94vh]']" class="flex justify-center items-center w-full">
      <v-btn v-if="lgAndUp" class="fixed right-5 top-5" icon color="secondary" variant="tonal"
        @click="showBigCatalog = !showBigCatalog">
        <v-icon color="secondary">
          {{ mdiBookOpenVariantOutline }}
        </v-icon>
      </v-btn>
      <!-- 书籍界面 -->

        <div class="w-[500px] h-[500px]" ref="foliateView"></div>

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
import { useDisplay } from "vuetify";
const { lgAndUp, mdAndUp } = useDisplay();

import { storeToRefs } from "pinia";
import { useSettingStore } from "@/store/setting";
const { showBigCatalog } = storeToRefs(useSettingStore());

import localforage from "localforage";
localforage.config({
  name: "epubBooks",
});
import { useBookSettingsStore } from "@/store/bookSettings";
const BSstore = useBookSettingsStore();

import { useBookStore } from "@/store/book";
import { mdiBookOpenVariantOutline, mdiPlus } from "@mdi/js";
const bookStore = useBookStore();
const foliateView = ref(null);
const view = document.createElement("foliate-view");
onMounted(async () => {
  foliateView.value.appendChild(view);


  // if (view) {
  //   view.addEventListener("relocate", (e) => {
  //     console.log("Location changed:");
  //     console.log(e.detail);
  //   });
  // }

  if (!bookStore.book) {
    const bookInForage = await localforage.getItem(
      BSstore.metadata.title.replace(/\(.*?\) |（.*?）/g, "")
    );
    if (bookInForage) {
      const blob = new Blob([bookInForage.book]);
      await view.open(blob); // 可以替换为 File 对象或实际路径
      view.goTo(1)
    }
  } else {
    // await view.open(bookStore.book); // 可以替换为 File 对象或实际路径
  }
  // await view.goTo(); // 可选
});

</script>

<style>
.theme-border {
  border: 3px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 6px;
}
</style>
