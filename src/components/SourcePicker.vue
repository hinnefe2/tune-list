<script setup lang="ts">
import { computed, ref } from 'vue'
import AutoComplete, { type AutoCompleteCompleteEvent, type AutoCompleteOptionSelectEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useSourcesStore } from '@/stores/sources'
import type { Source, SourceInsert, SourceUpdate } from '@/services/sources'
import SourceEditor from '@/components/SourceEditor.vue'
import { SOURCE_KIND_LABEL } from '@/lib/source-options'

const props = withDefaults(
  defineProps<{
    placeholder?: string
    excludeIds?: string[]
  }>(),
  { placeholder: 'Search sources…', excludeIds: () => [] },
)

const emit = defineEmits<{ select: [source: Source] }>()

const sourcesStore = useSourcesStore()

const query = ref<string | Source>('')
const suggestions = ref<Source[]>([])
const editorOpen = ref(false)
const presetName = ref('')
const saving = ref(false)
const errorMsg = ref<string | null>(null)

const excluded = computed(() => new Set(props.excludeIds))

function search(event: AutoCompleteCompleteEvent) {
  const q = (event.query ?? '').toLowerCase().trim()
  suggestions.value = sourcesStore.sources.filter(
    (s) => !excluded.value.has(s.id) && (q === '' || s.name.toLowerCase().includes(q)),
  )
}

function onOptionSelect(event: AutoCompleteOptionSelectEvent) {
  const s = event.value as Source
  emit('select', s)
  query.value = ''
}

const typedText = computed(() => (typeof query.value === 'string' ? query.value.trim() : ''))

const showCreateButton = computed(() => {
  const t = typedText.value
  if (!t) return false
  return !sourcesStore.sources.some((s) => s.name.toLowerCase() === t.toLowerCase())
})

function openCreate() {
  presetName.value = typedText.value
  editorOpen.value = true
}

async function handleSave(payload: SourceInsert | SourceUpdate) {
  saving.value = true
  errorMsg.value = null
  try {
    const created = await sourcesStore.create(payload as Omit<SourceInsert, 'user_id'>)
    editorOpen.value = false
    query.value = ''
    emit('select', created)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

</script>

<template>
  <div class="space-y-2">
    <AutoComplete
      v-model="query"
      :suggestions="suggestions"
      :placeholder="placeholder"
      option-label="name"
      class="w-full"
      input-class="w-full"
      complete-on-focus
      @complete="search"
      @option-select="onOptionSelect"
    >
      <template #option="{ option }">
        <div class="flex flex-col">
          <span>{{ option.name }}</span>
          <span class="text-xs text-surface-500">{{ SOURCE_KIND_LABEL[(option as Source).kind] }}</span>
        </div>
      </template>
    </AutoComplete>

    <div v-if="showCreateButton">
      <Button
        severity="secondary"
        size="small"
        text
        @click="openCreate"
      >
        <i class="pi pi-plus mr-2" /> Create source "{{ typedText }}"
      </Button>
    </div>

    <Dialog
      v-model:visible="editorOpen"
      header="Add source"
      modal
      :style="{ width: 'min(520px, 95vw)' }"
      :dismissable-mask="!saving"
    >
      <p v-if="errorMsg" class="text-sm text-red-600 dark:text-red-400 mb-3">{{ errorMsg }}</p>
      <SourceEditor
        :source="null"
        :seed-name="presetName"
        @save="handleSave"
        @cancel="editorOpen = false"
      />
    </Dialog>
  </div>
</template>
