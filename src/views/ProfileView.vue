<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Button from 'primevue/button'

const auth = useAuthStore()
const router = useRouter()
const signingOut = ref(false)

async function handleSignOut() {
  signingOut.value = true
  try {
    await auth.signOut()
    await router.push({ name: 'login' })
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8 space-y-6">
    <h1 class="text-2xl font-semibold">Profile</h1>

    <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
      <dt class="text-surface-500">Display name</dt>
      <dd>{{ auth.profile?.display_name ?? '—' }}</dd>
      <dt class="text-surface-500">Email</dt>
      <dd>{{ auth.user?.email ?? '—' }}</dd>
      <dt class="text-surface-500">User ID</dt>
      <dd class="font-mono text-xs">{{ auth.user?.id ?? '—' }}</dd>
    </dl>

    <Button severity="secondary" :loading="signingOut" @click="handleSignOut">
      <i class="pi pi-sign-out mr-2" /> Sign out
    </Button>
  </div>
</template>
