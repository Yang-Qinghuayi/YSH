<template>
  <v-app class="v-player">
    <!-- 左侧边栏 -->
    <app-nav v-if="lgAndUp" class="v-player-nav" />
    <app-bottom-nav v-if="!lgAndUp && showBottomNav" />

    <!-- 主要内容 -->
    <app-content id="v-player-content" class="v-player-content" />

    <!-- 目录 -->
    <v-navigation-drawer v-model="catalog" location="bottom" temporary>
      <Directory class="px-2 py-4" />
    </v-navigation-drawer>
  </v-app>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSettingStore } from "@/store/setting";

const { catalog } = storeToRefs(useSettingStore()) as any;
const { showBottomNav } = storeToRefs(useSettingStore()) as any;

import { useDisplay, useTheme } from "vuetify";

import { useCurrentTheme } from "@/hooks/useTheme";

import AppBottomNav from "./layout/BottomNav.vue";
import AppNav from "./layout/Navbar.vue";
import AppContent from "./layout/View.vue";

const { themeName } = useCurrentTheme();
const display = useDisplay();
const { lgAndUp } = display;
const theme = useTheme();
watchEffect(() => {
  theme.global.name.value = themeName.value;
});
</script>
<style lang="scss">
$cubic-bezier: cubic-bezier(0.55, -0.01, 0, 1.03);
$transition-time: 350ms;
.v-player-nav {
  border-inline-end-width: 0;
  transition-property: width;
  transition-duration: $transition-time;
  transition-timing-function: $cubic-bezier;
  .v-navigation-drawer__content {
    display: flex;
    flex-direction: column;
  }
  .content-warp {
    display: flex;
    flex-direction: column;
    .list-content {
      flex: initial;
      transition: flex $transition-time $cubic-bezier;
    }
    &.rail-nav {
      .list-content {
        flex: auto;
      }
    }
  }
}
.v-player-content {
  transition: padding $transition-time $cubic-bezier;
}
.v-player-header {
  transition-property: left, width;
  transition-duration: $transition-time;
  transition-timing-function: $cubic-bezier;
}
.is-desktop {
  user-select: none;
}
.v-player {
  //border-radius: 20px;
  // border: 8px solid rgba(var(--v-theme-primary), 0.2);
  transform: scale(1);
  overflow-y: hidden;
  overflow-x: hidden;
  .v-application__wrap {
    min-height: initial !important;
  }
}
</style>
