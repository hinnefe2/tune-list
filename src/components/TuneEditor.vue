<script setup lang="ts">
import { ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import InputChips from 'primevue/inputchips'
import Button from 'primevue/button'
import type { Tune, TuneInsert, TuneUpdate } from '@/services/tunes'
import {
  COMMON_KEYS,
  COMMON_TUNINGS,
  STATUS_OPTIONS,
} from '@/lib/tune-options'

interface Form {
  name: string
  aka: string[]
  key: string | null
  alt_keys: string[]
  tuning: string
  genre: string | null
  status: TuneInsert['status']
  notes: string | null
}

const props = defineProps<{ tune: Tune | null }>()
const emit = defineEmits<{
  save: [payload: TuneInsert | TuneUpdate, isUpdate: boolean]
  cancel: []
}>()

const blank = (): Form => ({
  name: '',
  aka: [],
  key: null,
  alt_keys: [],
  tuning: 'GDAE',
  genre: null,
  status: 'wishlist',
  notes: null,
})

const form = ref<Form>(blank())
const submitting = ref(false)
const errorMsg = ref<string | null>(null)

watch(
  () => props.tune,
  (t) => {
    errorMsg.value = null
    if (!t) {
      form.value = blank()
      return
    }
    form.value = {
      name: t.name,
      aka: t.aka ?? [],
      key: t.key,
      alt_keys: t.alt_keys ?? [],
      tuning: t.tuning,
      genre: t.genre,
      status: t.status,
      notes: t.notes,
    }
  },
  { immediate: true },
)

const keyOptions = COMMON_KEYS.map((k) => ({ value: k, label: k }))
const tuningOptions = COMMON_TUNINGS.map((t) => ({ value: t, label: t }))

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
      aka: form.value.aka,
      key: form.value.key,
      alt_keys: form.value.alt_keys,
      tuning: form.value.tuning,
      genre: form.value.genre,
      status: form.value.status,
      notes: form.value.notes?.trim() || null,
    }
    emit('save', payload, props.tune !== null)
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
        placeholder="Big John McNeil"
        autocapitalize="words"
        autocomplete="off"
      />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="space-y-1">
        <label class="block text-sm font-medium">Status</label>
        <Select
          v-model="form.status"
          :options="STATUS_OPTIONS"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium">Tuning</label>
        <Select
          v-model="form.tuning"
          :options="tuningOptions"
          option-label="label"
          option-value="value"
          editable
          class="w-full"
        />
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium">Key</label>
        <Select
          v-model="form.key"
          :options="keyOptions"
          option-label="label"
          option-value="value"
          editable
          show-clear
          class="w-full"
          placeholder="—"
        />
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium">Genre</label>
        <InputText v-model="form.genre" class="w-full" placeholder="Old Time, Irish, …" />
      </div>
    </div>

    <div class="space-y-1">
      <label class="block text-sm font-medium">Alternate keys</label>
      <InputChips v-model="form.alt_keys" class="w-full" separator="," placeholder="press enter" />
    </div>

    <div class="space-y-1">
      <label class="block text-sm font-medium">Also known as</label>
      <InputChips v-model="form.aka" class="w-full" separator="," placeholder="press enter" />
    </div>

    <div class="space-y-1">
      <label class="block text-sm font-medium">Notes</label>
      <Textarea v-model="form.notes" class="w-full" rows="3" auto-resize />
    </div>

    <p v-if="errorMsg" class="text-sm text-red-600 dark:text-red-400">{{ errorMsg }}</p>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" severity="secondary" text @click="emit('cancel')">Cancel</Button>
      <Button type="submit" :loading="submitting">
        {{ tune ? 'Save changes' : 'Add tune' }}
      </Button>
    </div>
  </form>
</template>
