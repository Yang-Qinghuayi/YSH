<template>
  <v-navigation-drawer :rail="rail" rail-width="102" class="drag-area">
    <div class="px-3 mt-6" :class="{ 'mb-1': rail }">
      <drawer-toggle />
    </div>
    <div class="content-warp flex-fill mt-4">
      <transition name="slide-fade-x">
        <div class="list-content d-flex flex-column justify-center">
          <v-list rounded :nav="true">
            <v-list-item
              v-for="item in nav"
              :key="item.val"
              class="drawer-item rounded-pill no-drag-area"
              :to="item.to"
              active-class="text-primary"
              :style="{ minHeight: '56px' }"
            >
              <template #prepend>
                <div
                  class="d-flex justify-center align-center"
                  :style="{ width: '40px', height: '40px' }"
                >
                  <gpt
                    :style="{ fill: currentTheme.colors.primary }"
                    v-if="item.icon === 'gpt'"
                  />
                  <v-icon
                    v-else
                    size="small"
                    :icon="item.icon"
                    color="primary"
                  ></v-icon>
                </div>
              </template>
              <v-list-item-title class="font-weight-bold">
                {{ $t(item.title) }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </div>
      </transition>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { useTheme } from "vuetify";
const vuetifyTheme = useTheme();
const currentTheme = computed(() => {
  return vuetifyTheme.current.value;
});

import {
  mdiCog,
  mdiBookshelf,
  mdiCloudOutline,
  mdiBookOpenVariantOutline,
} from "@mdi/js";
import gpt from "@/pages/components/GptIcon.vue";
import { storeToRefs } from "pinia";
import AppAccount from "@/components/button/Account.vue";
import { useSettingStore } from "@/store/setting";
import { useRouter } from "vue-router";

const { rail } = storeToRefs(useSettingStore()) as any;

const nav = computed(() => {
  return [
    {
      icon: mdiBookOpenVariantOutline,
      val: "book",
      title: "书籍",
      to: "/book",
    },
    {
      icon: mdiBookshelf,
      val: "bookShelves",
      title: t("book.bookshelf"),
      to: "/bookShelves",
    },
    {
      icon: mdiCog,
      val: "setting",
      title: t("common.setting"),
      to: "/setting",
    },
  ];
});

// 点击跳转函数,使用router
const router = useRouter();
const toPage = (path: string) => {
  router.push(path);
};
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>
