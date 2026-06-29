<template>
  <v-chip
    :color="ENTRY_TYPE_COLORS[type]"
    :size="size"
    variant="tonal"
    class="font-weight-medium"
  >
    {{ ENTRY_TYPE_LABELS[type] }}
  </v-chip>
</template>

<script setup lang="ts">
import type { EntryType } from '@/types/lore'
import { ENTRY_TYPE_LABELS, ENTRY_TYPE_COLORS } from '@/types/lore'

defineProps<{
  type: EntryType
  size?: 'x-small' | 'small' | 'default'
}>()
</script>
