<template>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>
<script setup lang="ts">
import { useSettingsStore } from '@/store/settingsStore';
const settingsStore = useSettingsStore();
const { settings, setSettings, saveSettings } = settingsStore;
import { useLibraryStore } from "@/store/libraryStore"
const libraryStore = useLibraryStore()
const {
  setLibrary,
  setCheckOpenWithBooks,
} = libraryStore
import { inject, provide, reactive, readonly, ref, onMounted } from 'vue';
import { EnvConfigType } from '@/services/environment';
import env from '@/services/environment';
import { AppService } from '@/types/system';
import { EnvSymbol } from "./hooks/useEnv";

const envConfig = reactive(env) as EnvConfigType;
const appService = ref<AppService | null>(null);

onMounted(async () => {
  appService.value = await envConfig.getAppService();
  const settingsData = await appService.value?.loadSettings();
  settingsData && setSettings(settingsData);

  const libraryBooks = await appService.value?.loadLibraryBooks();
  setCheckOpenWithBooks(false);
  libraryBooks && setLibrary(libraryBooks);
});

provide(EnvSymbol, {
  envConfig: readonly(envConfig),
  appService
});

</script>
