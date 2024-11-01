<style scoped>
.all {
  border-radius: 6px;
  border: 3px solid #e7ebda;
}
.head {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0.5rem;
  font-size: 1.6rem;
  font-weight: bold;
  color: #453b33;
}

.head :nth-child(2) {
  font-size: 1.2rem;
  margin-top: 4px;
}

.content {
  padding: 0.5rem;
  font-size: 1.2rem;
  cursor: pointer;
  overflow: auto;
  max-height: 60vh;
}

.content .item {
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid #f5f5f5;
  border-radius: 10px;
}
</style>
<template>
  <div class="all">
    <div class="head">
      <div class="line-clamp-1">{{ store.metadata?.title }}</div>
      <div class="line-clamp-1">
        {{ store.metadata?.creator }}
      </div>
    </div>
    <!-- 目录内容 -->
    <div class="content">
      <div
        class="item"
        :class="{ selected: store.section === index }"
        :style="contentItemStyle(item)"
        @click="displayContent(item.href)"
        v-for="(item, index) in store.navItems"
      >
        <span>
          {{ item.label }}
        </span>
        <span class="">{{ item.page }} </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useBookSettingsStore } from "@/store/bookSettings";
import { refreshLocation } from "@/pages/epub/epubUtil";
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

function contentItemStyle(item) {
  return {
    marginLeft: `${0.3 * item.level}rem`,
  };
}
</script>
