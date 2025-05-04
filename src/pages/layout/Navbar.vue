<template>
  <v-navigation-drawer :rail="rail" rail-width="102" width="198"  class="" >
    <div class="px-3 mt-6" :class="{ 'mb-1': rail }">
      <drawer-toggle />
    </div>
    <div class="content-warp flex-fill mt-4">
      <transition name="slide-fade-x">
        <div class="list-content d-flex flex-column justify-center">
          <v-list rounded :nav="true">
            <v-list-item v-for="item in nav" :key="item.val" class="drawer-item rounded-pill no-drag-area" :to="item.to"
              active-class="text-primary" :style="{ minHeight: '56px' }">
              <template #prepend>
                <div class="d-flex justify-center align-center" :style="{ width: '40px', height: '40px' }">
                  <v-icon size="small" :icon="item.icon" color="primary"></v-icon>
                </div>
              </template>
              <v-list-item-title class="font-weight-bold">
                {{ $t(item.title) }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </div>
      </transition>
      <!-- here is font setter -->
      <!-- <TrackSlider v-if="!rail" /> -->
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
  mdiBookOpenVariantOutline,
  mdiEmailFastOutline,
} from "@mdi/js";
import { storeToRefs } from "pinia";
import { useSettingStore } from "@/store/setting";

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
      val: "library",
      title: t("book.bookshelf"),
      to: "/library",
    },
    {
      icon: mdiCog,
      val: "setting",
      title: t("common.setting"),
      to: "/setting",
    },
    {
      icon: mdiEmailFastOutline,
      val: "setting",
      title: "信来",
      to: "/letter",
    },
  ];
});

import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>
