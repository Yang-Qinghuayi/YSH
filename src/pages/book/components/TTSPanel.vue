<template>
  <div class="w-full mt-6">
    <p class="text-gray-700 mb-1">文本朗读</p>
    <p class="text-xs text-gray-400 mb-3">{{ statusText }}</p>

    <!-- 播放控制 -->
    <div class="flex items-center justify-center gap-2 mb-5">
      <v-btn icon size="small" variant="tonal" :disabled="!ready" @click="onBackward">
        <v-icon>{{ mdiSkipPrevious }}</v-icon>
      </v-btn>
      <v-btn icon variant="tonal" :disabled="!ready" @click="onPlay">
        <v-icon>{{ tts.isPlaying ? mdiPause : mdiPlay }}</v-icon>
      </v-btn>
      <v-btn icon size="small" variant="tonal" :disabled="!ready" @click="onStop">
        <v-icon>{{ mdiStop }}</v-icon>
      </v-btn>
      <v-btn icon size="small" variant="tonal" :disabled="!ready" @click="onForward">
        <v-icon>{{ mdiSkipNext }}</v-icon>
      </v-btn>
    </div>

    <!-- 速率 -->
    <div class="mb-5">
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span>朗读速率</span>
        <span>{{ rate.toFixed(1) }}x</span>
      </div>
      <v-slider
        v-model="rate"
        :min="0.5"
        :max="2"
        :step="0.1"
        hide-details
        color="primary"
        :disabled="!ready"
        @end="onRateChange"
      />
    </div>

    <!-- 音色 -->
    <v-select
      :model-value="tts.voiceId"
      :items="voiceItems"
      item-title="name"
      item-value="id"
      label="音色"
      density="compact"
      hide-details
      :disabled="!ready || voiceItems.length === 0"
      @update:model-value="onVoiceChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { mdiPlay, mdiPause, mdiStop, mdiSkipNext, mdiSkipPrevious } from '@mdi/js';
import { useTTSStore } from '@/store/ttsStore';
import { useViewSettings } from '@/hooks/useViewSettings';
import { useReaderStore } from '@/store/readerStore';

const tts = useTTSStore();
const { bookId, viewSettings } = useViewSettings();
const readerStore = useReaderStore();

const rate = ref(viewSettings.value?.ttsRate ?? 1.3);
const ready = ref(false);

const voiceItems = computed(() => {
  const items: { id: string; name: string }[] = [];
  for (const group of tts.voices) {
    for (const voice of group.voices) {
      items.push({ id: voice.id, name: `${group.name} · ${voice.name}` });
    }
  }
  return items;
});

const statusText = computed(() => {
  if (!ready.value) return '正在准备朗读引擎…';
  if (tts.isPlaying) return '正在朗读…';
  if (tts.isPaused) return '已暂停';
  return '点击播放开始朗读';
});

const currentLang = () => readerStore.getView(bookId.value)?.language?.locale || '';

const ensureInit = async () => {
  if (tts.getController(bookId.value)) return true;
  const view = readerStore.getView(bookId.value);
  if (!view) return false;
  await tts.init(bookId.value, view);
  return true;
};

const onPlay = async () => {
  if (!(await ensureInit())) return;
  await tts.play(bookId.value);
};
const onStop = async () => {
  await tts.stop(bookId.value);
};
const onForward = async () => {
  if (!(await ensureInit())) return;
  await tts.forward(bookId.value);
};
const onBackward = async () => {
  if (!(await ensureInit())) return;
  await tts.backward(bookId.value);
};
const onRateChange = async (v: number) => {
  if (!(await ensureInit())) return;
  await tts.setRate(bookId.value, v);
};
const onVoiceChange = async (v: string) => {
  if (!(await ensureInit())) return;
  await tts.setVoice(bookId.value, v, currentLang());
};

onMounted(async () => {
  try {
    await ensureInit();
    await tts.loadVoices(bookId.value, currentLang());
    ready.value = true;
  } catch (e) {
    console.error('TTS init failed', e);
  }
});

// 外部（快捷键）改速率时同步本地滑块。
watch(
  () => viewSettings.value?.ttsRate,
  (v) => {
    if (v) rate.value = v;
  },
);
</script>
