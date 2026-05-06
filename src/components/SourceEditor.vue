<script setup lang="ts">
import { ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import type { Source, SourceInsert, SourceUpdate, SourceKind } from '@/services/sources'
import { SOURCE_KIND_OPTIONS } from '@/lib/source-options'

interface Form {
  name: string
  kind: SourceKind
  occurred_on: Date | null
  notes: string | null
}

const props = withDefaults(
  defineProps<{ source: Source | null; seedName?: string }>(),
  { seedName: '' },
)
const emit = defineEmits<{
  save: [payload: SourceInsert | SourceUpdate, isUpdate: boolean]
  cancel: []
}>()

const blank = (): Form => ({
  name: props.seedName ?? '',
  kind: 'other',
  occurred_on: null,
  notes: null,
})

const form = ref<Form>(blank())
const submitting = ref(false)
const errorMsg = ref<string | null>(null)

watch(
  () => props.source,
  (s) => {
    errorMsg.value = null
    if (!s) {
      form.value = blank()
      return
    }
    form.value = {
      name: s.name,
      kind: s.kind,
      occurred_on: s.occurred_on ? new Date(s.occurred_on + 'T00:00:00') : null,
      notes: s.notes,
    }
  },
  { immediate: true },
)

async function handleSubmit() {
  errorMsg.value = null
  if (!form.value.name.trim()) {
    errorMsg.value = 'Name is required.'
    return
  }
  submitting.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      kind: form.value.kind,
      occurred_on: form.value.occurred_on
        ? form.value.occurred_on.toISOString().slice(0, 10)
        : null,
      notes: form.value.notes?.trim() || null,
    }
    emit('save', payload, props.source !== null)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="handleSubmit">
    <div class="space-y-1">
      <label class="block text-sm font-medium">Name</label>
      <InputText
        v-model="form.name"
        autofocus
        class="w-full"
        placeholder="Borelli's, Clifftop 2024, Eileen's brother…"
        autocapitalize="words"
        autocomplete="off"
      />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="space-y-1">
        <label class="block text-sm font-medium">Kind</label>
        <Select
          v-model="form.kind"
          :options="SOURCE_KIND_OPTIONS"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>
      <div class="space-y-1">
        <label class="block text-sm font-medium">Date <span class="text-surface-400">(optional, for one-shot events)</span></label>
        <DatePicker v-model="form.occurred_on" class="w-full" date-format="yy-mm-dd" show-button-bar />
      </div>
    </div>

    <div class="space-y-1">
      <label class="block text-sm font-medium">Notes</label>
      <Textarea v-model="form.notes" class="w-full" rows="3" auto-resize />
    </div>

    <p v-if="errorMsg" class="text-sm text-red-600 dark:text-red-400">{{ errorMsg }}</p>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" severity="secondary" text @click="emit('cancel')">Cancel</Button>
      <Button type="submit" :loading="submitting">
        {{ source ? 'Save changes' : 'Add source' }}
      </Button>
    </div>
  </form>
</template>
