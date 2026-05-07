<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import Button from 'primevue/button'

const auth = useAuthStore()
const error = ref<string | null>(null)
const loading = ref(false)

async function handleSignIn() {
  loading.value = true
  error.value = null
  try {
    await auth.signInWithGoogle()
    // OAuth redirect — control leaves the page.
  } catch (e) {
    loading.value = false
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-6 py-16">
    <div class="w-full max-w-sm text-center space-y-8">
      <div class="space-y-2">
        <h1 class="text-3xl font-semibold tracking-tight">Tune List</h1>
        <p class="text-surface-600 dark:text-surface-400 text-sm">
          A place to track the fiddle tunes you know and hope to learn one day
        </p>
      </div>

      <Button
        :loading="loading"
        severity="secondary"
        class="w-full"
        @click="handleSignIn"
      >
        <template #default>
          <span class="flex items-center gap-2">
            <i class="pi pi-google" />
            <span>Continue with Google</span>
          </span>
        </template>
      </Button>

      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>
  </div>
</template>
