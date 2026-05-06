<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Tune } from '@/services/tunes'
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/tune-options'

const props = defineProps<{ tune: Tune }>()

const subtitle = computed(() => {
  const bits: string[] = []
  if (props.tune.key) bits.push(props.tune.key)
  if (props.tune.tuning && props.tune.tuning !== 'GDAE') bits.push(props.tune.tuning)
  if (props.tune.genre) bits.push(props.tune.genre)
  return bits.join(' · ')
})

const akaText = computed(() => (props.tune.aka.length ? `aka ${props.tune.aka.join(', ')}` : ''))
</script>

<template>
  <RouterLink
    :to="{ name: 'tune-detail', params: { id: tune.id } }"
    class="block px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-900 border-b border-surface-200 dark:border-surface-800"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="font-medium truncate">{{ tune.name }}</div>
        <div v-if="subtitle" class="text-sm text-surface-500 truncate">{{ subtitle }}</div>
        <div v-if="akaText" class="text-xs text-surface-400 truncate">{{ akaText }}</div>
      </div>
      <span
        :class="[
          'shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
          STATUS_BADGE[tune.status],
        ]"
      >
        {{ STATUS_LABEL[tune.status] }}
      </span>
    </div>
  </RouterLink>
</template>
