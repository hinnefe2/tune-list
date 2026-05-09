<script setup lang="ts">
import Dialog from 'primevue/dialog'

defineProps<{ visible: boolean }>()
defineEmits<{ 'update:visible': [boolean] }>()

type Item = { keys: string[]; desc: string; sep?: string }
type Group = { name: string; items: Item[] }

const groups: Group[] = [
  {
    name: 'Navigation',
    items: [
      { keys: ['g', 't'], desc: 'Go to Tunes' },
      { keys: ['g', 'c'], desc: 'Go to Capture' },
      { keys: ['g', 'l'], desc: 'Go to Learn' },
      { keys: ['g', 'p'], desc: 'Go to Practice' },
      { keys: ['g', 'g'], desc: 'Scroll to top' },
      { keys: ['Shift', 'G'], desc: 'Scroll to bottom', sep: '+' },
    ],
  },
  {
    name: 'Tunes list',
    items: [
      { keys: ['/'], desc: 'Focus search' },
      { keys: ['Esc'], desc: 'Leave search' },
      { keys: ['a'], desc: 'Add tune' },
      { keys: ['j'], desc: 'Move selection down' },
      { keys: ['k'], desc: 'Move selection up' },
      { keys: ['Enter'], desc: 'Open selected tune' },
      { keys: ['1'], desc: 'Set status: Wishlist' },
      { keys: ['2'], desc: 'Set status: Learning' },
      { keys: ['3'], desc: 'Set status: Can follow' },
      { keys: ['4'], desc: 'Set status: Can lead' },
      { keys: ['5'], desc: 'Set status: Forgotten' },
    ],
  },
  {
    name: 'Tune detail',
    items: [{ keys: ['p'], desc: 'Play first media link' }],
  },
  {
    name: 'Global',
    items: [{ keys: ['?'], desc: 'Show this help' }],
  },
]
</script>

<template>
  <Dialog
    :visible="visible"
    header="Keyboard shortcuts"
    modal
    :style="{ width: 'min(440px, 95vw)' }"
    :dismissable-mask="true"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="space-y-5">
      <section v-for="g in groups" :key="g.name">
        <h3 class="text-xs font-medium uppercase tracking-wider text-surface-500 mb-2">
          {{ g.name }}
        </h3>
        <ul class="space-y-1.5">
          <li
            v-for="item in g.items"
            :key="item.desc"
            class="flex items-center justify-between gap-3 text-sm"
          >
            <span>{{ item.desc }}</span>
            <span class="flex items-center gap-1">
              <template v-for="(k, idx) in item.keys" :key="idx">
                <span v-if="idx > 0" class="text-xs text-surface-400">{{ item.sep ?? 'then' }}</span>
                <kbd
                  class="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 h-6 rounded border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-xs font-mono"
                >{{ k }}</kbd>
              </template>
            </span>
          </li>
        </ul>
      </section>
    </div>
  </Dialog>
</template>
