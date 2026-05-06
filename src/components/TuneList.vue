<script setup lang="ts">
import type { Tune } from '@/services/tunes'
import TuneCard from '@/components/TuneCard.vue'

defineProps<{ tunes: Tune[] }>()
</script>

<template>
  <div v-if="tunes.length" class="border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden">
    <TuneCard v-for="t in tunes" :key="t.id" :tune="t" />
  </div>
  <slot v-else name="empty">
    <div class="py-16 text-center text-surface-500">No tunes match.</div>
  </slot>
</template>
