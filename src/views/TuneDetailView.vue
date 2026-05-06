<script setup lang="ts">
import PhasePlaceholder from '@/components/PhasePlaceholder.vue'

defineProps<{ id: string }>()
</script>

<template>
  <PhasePlaceholder title="Tune detail" phase="Phase 2" />
</template>
