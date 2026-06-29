<template>
  <div>
    <app-title path="common.language" />
    <v-list-item class="pa-0">
      <v-list-item-title class="text-caption mr-4"> {{ t('main.setting.language') }} </v-list-item-title>
      <template #append>
        <AppSelect v-model="lang" :items="localeOptions" />
      </template>
    </v-list-item>
  </div>
</template>
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from '@/utils/i18n'

import AppSelect from '@/components/menu/Select.vue'
import AppTitle from '@/components/Title.vue'
import { useSettingStore } from '@/store/setting'
const settingStore = useSettingStore()
const { locale: lang } = storeToRefs(settingStore) as any

const { t, locale } = useI18n()

const localeOptions = computed(() => {
  return [
    {
      title: t('common.zh-CN'),
      value: 'zhCN',
      activeClass: 'text-primary',
      rounded: true,
    },
    {
      title: t('common.en'),
      value: 'en',
      activeClass: 'text-primary',
      rounded: true,
    },
  ]
})

watch(lang, () => {
  locale.value = lang.value
})
</script>
