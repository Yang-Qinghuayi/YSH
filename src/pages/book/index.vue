<template>
  <div>
    <div v-if="!showBook">好像还没有书籍哦，快去书架添加吧</div>

    <div
      v-else
      :class="[lgAndUp ? 'mt-[4vh] h-[90vh]' : 'h-[94vh]']"
      class="flex justify-center items-center w-full"
    >
      <v-btn
        v-if="lgAndUp"
        class="fixed right-5 top-5"
        icon
        color="secondary"
        variant="tonal"
        @click="showBigCatalog = !showBigCatalog"
      >
        <v-icon color="secondary">
          {{ mdiBookOpenVariantOutline }}
        </v-icon>
      </v-btn>
      <!-- 书籍界面 -->

      <div
        :class="[lgAndUp ? 'w-[max(60vw,700px)]' : 'w-full']"
        class="h-full transition-all duration-600"
        @click="onMaskClick"
      >
        <div
          id="epub"
          ref="epub"
          :class="[
            mdAndUp
              ? 'w-[max(40vw,670px)] theme-border'
              : 'w-[min(100%,670px)] ',
          ]"
          class="m-auto h-full"
        ></div>
      </div>

      <!-- 目录部分 -->

      <transition
        name="fade"
        enter-active-class="transition ease-out duration-300"
        leave-active-class="transition ease-in duration-300"
      >
        <Directory
          class="w-[16vw] h-[70vh] mx-[2vw] px-2 py-4 overflow-auto theme-border"
          v-if="lgAndUp && showBigCatalog"
        />
      </transition>
    </div>
  </div>
</template>

<script setup>
import { useDisplay } from "vuetify";
const { lgAndUp, mdAndUp } = useDisplay();

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeyDown);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGlobalKeyDown);
});

const handleGlobalKeyDown = (event) => {
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    next();
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    prev();
  }
};

const epub = ref(null);
const width = ref(0);

// 得到epub元素的宽度
onMounted(() => {
  const element = epub.value;
  width.value = element.offsetWidth;
  //  监听窗口大小变化
  window.addEventListener("resize", () => {
    const element = epub.value;
    width.value = element.offsetWidth;
  });
});

import { storeToRefs } from "pinia";
import { useSettingStore } from "@/store/setting";
const { showBigCatalog } = storeToRefs(useSettingStore());

const { showBottomNav } = storeToRefs(useSettingStore());

// 点击事件，左右翻页，中间显示菜单
async function onMaskClick(e) {
  const offsetX = e.offsetX;
  if (offsetX > 0 && offsetX < 0.3 * width.value) {
    prev();
  } else if (offsetX > 0 && offsetX > 0.7 * width.value) {
    next();
  } else {
    // 显示菜单
    showBottomNav.value = !showBottomNav.value;
  }
}

import { useEpub } from "@/hooks/useEpub";
const {
  createBook,
  render,
  display,
  getRendition,
  setFontSize,
  next,
  prev,
  setFontFamily,
} = useEpub();

import localforage from "localforage";
localforage.config({
  name: "epubBooks",
});
import { useBookSettingsStore } from "@/store/bookSettings";
const BSstore = useBookSettingsStore();
import { useBookStore } from "@/store/book";
import { mdiBookOpenVariantOutline } from "@mdi/js";
const bookStore = useBookStore();

const showBook = ref(true);

// 是否在选择文本
const selecting = ref(false);

onMounted(async () => {
  if (!bookStore.book) {
    const bookInForage = await localforage.getItem(
      BSstore.metadata.title.replace(/\(.*?\) |（.*?）/g, "")
    );
    if (bookInForage) {
      createBook(bookInForage.book);
    } else {
      showBook.value = false;
    }
  } else {
    createBook();
  }
  render("epub", {
    width: "100%",
    height: "100% ",
    allowScriptedContent: true,
  });
  display();
  setFontSize(20);
  const rendition = getRendition();
  rendition.on("selected", bookSelectedEvent);

  rendition.on("click", (e, i) => {
    if (selecting.value) {
      selecting.value = false;
      return;
    }
    onMaskClick(e);
  });

  function bookSelectedEvent(cfiRange, contents) {
    selecting.value = true;

    // rendition.annotations.highlight(
    //   cfiRange, // 位置信息可通过rendition.display(cfiRange) 跳转
    //   null, // 第二个参数可以是个对象比如 {id: id}会添加在dom的自定义属性 data-id="id"
    //   function () {
    //     // 点击高亮区域时
    //     // 在这可以拿到第二个参数的值
    //     this.getAttribute("data-id"); // 就是第二个参数的值
    //   },
    //   null // 给高亮的元素添加className
    //   // { fill: color } // 设置样式，fill更改高亮颜色
    // );
  }
});
</script>

<style scoped>
.theme-border {
  border: 3px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 6px;
}
</style>
