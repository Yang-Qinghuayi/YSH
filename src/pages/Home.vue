<template>
  <v-app class="v-player">
    <!-- 桌面端左侧边栏 -->
    <app-nav v-if="!isMobile" class="v-player-nav" />

    <!-- 主要内容 -->
    <app-content id="v-player-content" class="v-player-content" />

    <!-- 移动端底部 Tab 导航 -->
    <v-bottom-navigation v-if="isMobile" v-model="activeTab" grow color="primary" bg-color="surface" :elevation="0" class="border-t border-outline/30">
      <v-btn
        v-for="item in nav"
        :key="item.val"
        :to="item.to"
        :value="item.to"
        stacked
      >
        <v-icon :icon="item.icon" />
        <span class="text-xs mt-1">{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>

  </v-app>
</template>

<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import { useMaterialYouTheme } from "@/hooks/useMaterialYouTheme";
import { useNavItems } from "@/hooks/useNavItems";
import AppNav from "./layout/Navbar.vue";
import AppContent from "./layout/View.vue";

useMaterialYouTheme();

// 用浏览器原生 matchMedia，比 Vuetify useDisplay 更可靠
const isMobile = useMediaQuery("(max-width: 960px)");
const { nav } = useNavItems();
const route = useRoute();
const activeTab = computed(() => route.path);
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
