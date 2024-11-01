<template>
  <v-app class="v-player" :class="{ 'is-desktop': isDesktop }">
    <!-- 左侧边栏 -->
    <app-nav v-if="smAndUp && navPosition === NavPosition.left" class="v-player-nav" />
    <!-- 好像没用的东西 -->
    <v-app-bar v-if="!inDeepPage && navPosition === NavPosition.left" height="20" flat></v-app-bar>
    <!-- 主要内容 -->
    <app-content id="v-player-content" class="v-player-content" />
    <!-- 手机端的组件 -->
    <app-mobile-playbar v-if="xs" />
    <app-bottom-nav v-if="xs" />
    <!-- 登录界面 -->
    <app-login />
    <!-- 播放界面 -->
    <app-playing-page />
  </v-app>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDisplay, useTheme } from 'vuetify'

import useInForeground from '@/hooks/useInForeground'
import { useCurrentTheme } from '@/hooks/useTheme'
import { NavPosition, useSettingStore } from '@/store/setting'
import is from '@/util/is'

import AppBottomNav from './layout/BottomNav.vue'
import AppMobilePlaybar from './layout/MobilePlaybar.vue'
import AppNav from './layout/Navbar.vue'
import AppContent from './layout/View.vue'
import AppLogin from './modal/Login.vue'
import AppPlayingPage from './mode/index.vue'

const { themeName } = useCurrentTheme()
const { miniPlayer, navPosition } = storeToRefs(useSettingStore())
const display = useDisplay()
const { xs, smAndUp } = display
const theme = useTheme()
watchEffect(() => {
  theme.global.name.value = themeName.value
})
const isShowWindowControl = computed(() => {
  return (is.windows() || is.linux()) && smAndUp.value && navPosition.value === NavPosition.left
})
const isDesktop = computed(() => {
  return is.electron()
})
const { isActive: inDeepPage } = useInForeground(['podcast', 'playlist', 'album', 'artist', 'search', 'video', 'daily'])
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
      //.v-list-item {
      //  &:hover .v-icon {
      //    animation: bounce 1s;
      //  }
      //}
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
  // border-radius: 20px;
  // border: 8px solid rgba(var(--v-theme-primary), 0.2);
  transform: scale(1);
  height: 100vh;
  overflow-y: hidden;
  overflow-x: hidden;
  //width: 100vw;
  .v-application__wrap {
    min-height: initial !important;
  }
}
</style>
