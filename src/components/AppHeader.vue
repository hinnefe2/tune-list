<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import Menu from 'primevue/menu'

const auth = useAuthStore()
const router = useRouter()
const { isDark, toggle: toggleTheme } = useTheme()

const menu = ref<InstanceType<typeof Menu> | null>(null)
const profileItems = computed(() => [
  {
    label: auth.profile?.display_name ?? auth.user?.email ?? 'Profile',
    items: [
      { label: 'Profile', icon: 'pi pi-user', command: () => router.push({ name: 'profile' }) },
      {
        label: isDark.value ? 'Light mode' : 'Dark mode',
        icon: isDark.value ? 'pi pi-sun' : 'pi pi-moon',
        command: () => toggleTheme(),
      },
      { label: 'Sign out', icon: 'pi pi-sign-out', command: () => signOut() },
    ],
  },
])

async function signOut() {
  await auth.signOut()
  await router.push({ name: 'login' })
}

const navLinks = [
  { name: 'tunes', label: 'Tunes' },
  { name: 'capture', label: 'Capture' },
  { name: 'learn', label: 'Learn' },
  { name: 'practice', label: 'Practice' },
] as const
</script>

<template>
  <header class="border-b border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-950">
    <div class="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <RouterLink
          :to="{ name: 'tunes' }"
          class="font-semibold tracking-tight text-lg shrink-0"
          aria-label="Tune List"
        >
          <span class="hidden sm:inline">Tune List</span>
          <span class="sm:hidden text-xl leading-none" aria-hidden="true">🎻</span>
        </RouterLink>
        <nav class="flex items-center gap-1">
          <RouterLink
            v-for="link in navLinks"
            :key="link.name"
            :to="{ name: link.name }"
            class="px-3 py-1.5 rounded-md text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
            active-class="!text-surface-900 dark:!text-surface-50 bg-surface-100 dark:bg-surface-800"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
      </div>
      <div>
        <button
          type="button"
          class="w-9 h-9 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-sm font-medium"
          aria-label="Profile menu"
          @click="(e) => menu?.toggle(e)"
        >
          {{ (auth.profile?.display_name ?? auth.user?.email ?? '?').charAt(0).toUpperCase() }}
        </button>
        <Menu ref="menu" :model="profileItems" :popup="true" />
      </div>
    </div>
  </header>
</template>
