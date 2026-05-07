<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'
import { useMetronomeStore } from '@/stores/metronome'

const metronome = useMetronomeStore()

const bpmModel = computed({
  get: () => metronome.bpm,
  set: (v: number) => metronome.setBpm(v),
})

const pulseStyle = computed(() => ({
  animationDuration: `${metronome.beatDurationSeconds}s`,
}))
</script>

<template>
  <div class="rounded-lg border border-surface-200 dark:border-surface-800 p-3 sm:p-4 space-y-3">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <span
          :class="[
            'inline-block w-2.5 h-2.5 rounded-full',
            metronome.running ? 'bg-emerald-500 animate-metronome-pulse' : 'bg-surface-300 dark:bg-surface-700',
          ]"
          :style="metronome.running ? pulseStyle : undefined"
          aria-hidden="true"
        />
        <span class="text-sm font-medium">Metronome</span>
      </div>
      <div class="flex items-center gap-2">
        <Button
          severity="secondary"
          size="small"
          outlined
          aria-label="Tap tempo"
          @click="metronome.tap"
        >
          Tap
        </Button>
        <Button
          :severity="metronome.running ? 'danger' : 'primary'"
          size="small"
          @click="metronome.toggle()"
        >
          <i :class="[metronome.running ? 'pi pi-pause' : 'pi pi-play', 'mr-1.5']" />
          {{ metronome.running ? 'Stop' : 'Start' }}
        </Button>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <InputNumber
        v-model="bpmModel"
        :min="metronome.minBpm"
        :max="metronome.maxBpm"
        show-buttons
        button-layout="horizontal"
        :input-style="{ width: '4rem', textAlign: 'center' }"
        decrement-button-class="!p-2"
        increment-button-class="!p-2"
      />
      <span class="text-xs text-surface-500 tabular-nums w-14">bpm</span>
      <Slider
        v-model="bpmModel"
        :min="metronome.minBpm"
        :max="metronome.maxBpm"
        class="flex-1"
      />
    </div>
  </div>
</template>

<style>
@keyframes metronome-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.6); opacity: 0.6; }
}
.animate-metronome-pulse {
  animation-name: metronome-pulse;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
}
</style>
