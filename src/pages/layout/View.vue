<template>
  <v-main class="overflow-y-auto" style="height: calc(100vh - 16px)">
    <v-container class="px-4 py-4 drag-area" fluid>
      <router-view v-slot="{ Component }">
        <transition name="route-animation" mode="out-in">
          <keep-alive include="Bookshelves">
            <suspense>
              <component :is="Component" class="no-drag-area" />
            </suspense>
          </keep-alive>
        </transition>
      </router-view>
    </v-container>
  </v-main>
</template>
