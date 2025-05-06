<template>
  <v-dialog v-model="showMenu" persistent>
    <v-card :class="[smAndUp ? 'w-[560px]' : 'w-full']" color="surface" class="flex items-center flex-col mx-auto p-10">
      <v-card-title class="text-center">菜单</v-card-title>
      <FontSizeSlider />
      <FontWeightSlider />
      <v-switch v-model="overrideFont" label="覆盖字体" hide-details color="primary" inset></v-switch>

      <v-btn class="w-[50vw] mt-4" variant="tonal" color="secondary" @click.prevent="switchShowMenu">
        关闭
      </v-btn>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import FontSizeSlider from "./FontSizeSlider.vue"
import FontWeightSlider from "./FontWeightSlider.vue"
import { useDisplay } from "vuetify";
const { lgAndUp, smAndUp } = useDisplay();

import { useBookIdStore } from '@/store/bookIdStore';
const { bookId } = storeToRefs(useBookIdStore())
import { saveViewSettings } from '@/utils/viewSettingsHelper';
import { useReaderStore } from '@/store/readerStore';
import { storeToRefs } from "pinia";
const readerStore = useReaderStore()
const { getProgress, getViewState, initViewState, getViewSettings, hoveredBookKey, switchShowMenu } = readerStore
const showMenu = defineModel<boolean>("showMenu", { required: true });

const viewSettings = getViewSettings(bookId.value);

const overrideFont = ref(false)
const init = async () => {
  await initLibrary()
  overrideFont.value = viewSettings?.overrideFont || false
}
init()


watch(overrideFont, () => {
  saveViewSettings(bookId.value, 'overrideFont', overrideFont.value);
})

</script>
