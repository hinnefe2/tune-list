<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useSourcesStore } from '@/stores/sources'
import SourceEditor from '@/components/SourceEditor.vue'
import type { Source, SourceInsert, SourceUpdate, SourceKind } from '@/services/sources'
import { SOURCE_KIND_OPTIONS, SOURCE_KIND_LABEL, SOURCE_KIND_ICON } from '@/lib/source-options'

const sourcesStore = useSourcesStore()
const toast = useToast()

const editorOpen = ref(false)
const editingSource = ref<Source | null>(null)
const search = ref('')
const kindFilter = ref<SourceKind | null>(null)

onMounted(async () => {
  try {
    await sourcesStore.init()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Failed to load sources',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  }
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sourcesStore.sources.filter((s) => {
    if (kindFilter.value && s.kind !== kindFilter.value) return false
    if (q && !s.name.toLowerCase().includes(q)) return false
    return true
  })
})

function openAdd() {
  editingSource.value = null
  editorOpen.value = true
}

function openEdit(s: Source) {
  editingSource.value = s
  editorOpen.value = true
}

async function handleSave(payload: SourceInsert | SourceUpdate, isUpdate: boolean) {
  try {
    if (isUpdate && editingSource.value) {
      await sourcesStore.update(editingSource.value.id, payload as SourceUpdate)
      toast.add({ severity: 'success', summary: 'Source updated', life: 2000 })
    } else {
      await sourcesStore.create(payload as Omit<SourceInsert, 'user_id'>)
      toast.add({ severity: 'success', summary: 'Source added', life: 2000 })
    }
    editorOpen.value = false
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 space-y-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h1 class="text-2xl font-semibold">Sources</h1>
      <Button @click="openAdd"><i class="pi pi-plus mr-2" /> Add source</Button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <IconField class="sm:col-span-2">
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="search"
          placeholder="Search sources…"
          class="w-full"
          enterkeyhint="search"
          @keydown.enter.prevent="(e: KeyboardEvent) => (e.target as HTMLElement).blur()"
        />
      </IconField>
      <Select
        v-model="kindFilter"
        :options="SOURCE_KIND_OPTIONS"
        option-label="label"
        option-value="value"
        placeholder="Any kind"
        show-clear
        class="w-full"
      />
    </div>

    <div v-if="sourcesStore.loading && !sourcesStore.initialized" class="py-16 text-center text-surface-500">
      <i class="pi pi-spin pi-spinner mr-2" /> Loading…
    </div>

    <div v-else-if="!sourcesStore.sources.length" class="py-20 text-center space-y-3">
      <p class="text-surface-500">No sources yet.</p>
      <Button @click="openAdd"><i class="pi pi-plus mr-2" /> Add your first source</Button>
    </div>

    <div v-else-if="!filtered.length" class="py-16 text-center text-surface-500">
      No sources match.
    </div>

    <ul v-else class="border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden">
      <li
        v-for="s in filtered"
        :key="s.id"
        class="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-200 dark:border-surface-800 last:border-b-0 hover:bg-surface-50 dark:hover:bg-surface-900"
      >
        <RouterLink :to="{ name: 'source-detail', params: { id: s.id } }" class="flex-1 min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <i :class="[SOURCE_KIND_ICON[s.kind], 'text-surface-400']" />
            <span class="font-medium truncate">{{ s.name }}</span>
          </div>
          <div class="text-xs text-surface-500 mt-0.5">
            {{ SOURCE_KIND_LABEL[s.kind] }}<template v-if="s.occurred_on"> · {{ s.occurred_on }}</template>
          </div>
        </RouterLink>
        <Button text rounded size="small" icon="pi pi-pencil" aria-label="Edit" @click="openEdit(s)" />
      </li>
    </ul>

    <Dialog
      v-model:visible="editorOpen"
      :header="editingSource ? 'Edit source' : 'Add source'"
      modal
      :style="{ width: 'min(520px, 95vw)' }"
      :dismissable-mask="true"
    >
      <SourceEditor :source="editingSource" @save="handleSave" @cancel="editorOpen = false" />
    </Dialog>
  </div>
</template>
