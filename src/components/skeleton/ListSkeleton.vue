<script setup lang="ts">
import { computed } from 'vue'
import { ContentLoader } from 'vue-content-loader'
import { useTheme } from 'vuetify'

import { useMainSize } from '@/hooks/useMainSize'

const { width } = useMainSize()

const theme = useTheme()
const surfaceColor = computed(() => theme.current.value.colors?.surfaceVariant)
const onSurfaceColor = computed(() => theme.current.value.colors?.surface)
const itemHeight = 56
</script>
<template>

  <content-loader
    :viewBox="`0 0 ${width ?? 700} ${itemHeight * 3}`"
    :primary-color="surfaceColor"
    :secondary-color="onSurfaceColor"
    :animate="true"
  >
    <rect x="8" y="0" rx="48" ry="48" width="48" height="48" />
    <rect x="64" y="10" rx="3" ry="3" width="256" height="10" />
    <rect x="64" y="28" rx="3" ry="3" width="256" height="10" />
    <rect :x="width - 104" y="8" rx="3" ry="3" width="50" height="16" />

    <rect x="8" :y="itemHeight" rx="48" ry="48" width="48" height="48" />
    <rect x="64" :y="itemHeight + 10" rx="3" ry="3" width="256" height="10" />
    <rect x="64" :y="itemHeight + 28" rx="3" ry="3" width="256" height="10" />
    <rect :x="width - 104" :y="itemHeight + 8" rx="3" ry="3" width="50" height="16" />

    <rect x="8" :y="itemHeight*2" rx="48" ry="48" width="48" height="48" />
    <rect x="64" :y="itemHeight*2 + 10" rx="3" ry="3" width="256" height="10" />
    <rect x="64" :y="itemHeight*2 + 28" rx="3" ry="3" width="256" height="10" />
    <rect :x="width - 104" :y="itemHeight*2 + 8" rx="3" ry="3" width="50" height="16" />
  </content-loader>
</template>
