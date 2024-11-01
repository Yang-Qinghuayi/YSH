<template>
  <div>
    <v-list-item
      class="p-2 px-3 rounded-pill no-drag-area"
      @click="handleClick(item)"
      >{{ item.label }}</v-list-item
    >
    <ul v-if="item.subitems?.length && showSubitems">
      <DirectoryItem
        v-for="subitem in item.subitems"
        :item="subitem"
      ></DirectoryItem>
    </ul>
  </div>
</template>

<script setup>
// 隐藏子目录
const showSubitems = ref(false);

import { storeToRefs } from "pinia";
import { useSettingStore } from "@/store/setting";
const { catalog } = storeToRefs(useSettingStore());

function handleClick(item) {
  if (item.subitems?.length) {
    showSubitems.value = !showSubitems.value;
  } else {
    displayContent(item.href);
    catalog.value = false;
  }
}

import DirectoryItem from "./DirectoryItem.vue";

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
});

import { useBookSettingsStore } from "@/store/bookSettings";
import { refreshLocation } from "@/pages/book/epubUtil";
import { useBookStore } from "@/store/book";

const store = useBookSettingsStore();
const bookStore = useBookStore();

const displays = (target, callback) => {
  if (target) {
    bookStore.book.rendition.display(target).then(() => {
      refreshLocation();
      if (callback) callback();
    });
  } else {
    bookStore.book.rendition.display().then(() => {
      refreshLocation();
      if (callback) callback();
    });
  }
};

const displayContent = (target, highlight = false) => {
  displays(target, () => {
    store.TOGGLE_TITLEANDMENUVISIABLE();
    // 搜索字段在文中高亮
    highlight ? store.book.rendition.annotations.highlight(target) : null;
  });
};
</script>

<style scoped>
ul {
  list-style-type: none;
  padding-left: 14px;
}
</style>
