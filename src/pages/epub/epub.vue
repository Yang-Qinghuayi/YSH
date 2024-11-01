<template>
  <div class="flex justify-center items-center h-[92vh] w-full">
    <!-- 书籍界面 -->
    <div class="w-[60vw] h-full mt-[8vh]" @click="onMaskClick">
      <div
        id="epub"
        ref="epub"
        class="m-auto w-[40vw] h-[90%] border-solid border-2 rounded-md border-[#e7ebda]"
      ></div>
    </div>

    <!-- 目录部分 -->
    <div class="w-[20vw]">
      <content />
    </div>
  </div>
</template>

<script setup>
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

import content from "./content.vue";
let epub = ref(null);
let width = 0;

// 得到epub元素的宽度
onMounted(() => {
  const element = epub.value;
  width = element.offsetWidth;
});

// 点击事件，左右翻页，中间显示菜单
async function onMaskClick(e) {
  let offsetX = e.offsetX;
  if (offsetX > 0 && offsetX < 0.3 * width) {
    prev();
  } else if (offsetX > 0 && offsetX > 0.7 * width) {
    next();
  } else {
    // toggleMenuAndTitle()
  }
  e.preventDefault();
  e.stopPropagation();
}

// 挂载epub
import { useEpub } from "@/hooks/useEpub";
const { createBook, render, display, getRendition, setFontSize, next, prev } =
  useEpub();

import localforage from "localforage";
localforage.config({
  name: "epubBooks",
});
import { useBookSettingsStore } from "@/store/bookSettings";
const BSstore = useBookSettingsStore();
import { useBookStore } from "@/store/book";
const bookStore = useBookStore();

onMounted(async () => {
  if (!bookStore.book) {
    const bookInForage = await localforage.getItem(BSstore.metadata.title);
    createBook(bookInForage.book);
  } else {
    createBook();
  }
  render("epub", { width: "100%", height: "100%" });
  display();
  setFontSize(20);
  const rendition = getRendition();
  rendition.on("selected", bookSelectedEvent);

  function bookSelectedEvent(cfiRange, contents) {
    rendition.annotations.highlight(
      cfiRange, // 位置信息可通过rendition.display(cfiRange) 跳转
      null, // 第二个参数可以是个对象比如 {id: id}会添加在dom的自定义属性 data-id="id"
      function () {
        // 点击高亮区域时
        // 在这可以拿到第二个参数的值
        this.getAttribute("data-id"); // 就是第二个参数的值
      },
      null, // 给高亮的元素添加className
      { fill: color } // 设置样式，fill更改高亮颜色
    );
  }
});
</script>

<style scoped>
.ebook-mask {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  background: transparent;
}
</style>
