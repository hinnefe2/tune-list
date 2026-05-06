<script setup lang="ts">
defineProps<{
  title: string
  phase: string
}>()
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12 text-center space-y-3">
    <h1 class="text-2xl font-semibold">{{ title }}</h1>
    <p class="text-surface-500 dark:text-surface-400">
      Coming in {{ phase }}.
    </p>
  </div>
</template>
