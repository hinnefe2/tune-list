<script setup lang="ts">
import PhasePlaceholder from '@/components/PhasePlaceholder.vue'

defineProps<{ id: string }>()
</script>

<template>
  <PhasePlaceholder title="Source detail" phase="Phase 3" />
</template>
