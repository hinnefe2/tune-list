<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppHeader from '@/components/AppHeader.vue'
import ShortcutsHelp from '@/components/ShortcutsHelp.vue'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import { useNavShortcuts, useShortcut } from '@/composables/useShortcuts'

const auth = useAuthStore()
const route = useRoute()

const showHeader = computed(() => auth.isSignedIn && route.name !== 'login')

useNavShortcuts()

const helpOpen = ref(false)
useShortcut('?', (e) => {
  e.preventDefault()
  helpOpen.value = !helpOpen.value
})
</script>

<template>
  <div class="min-h-full flex flex-col">
    <AppHeader v-if="showHeader" />
    <main class="flex-1">
      <router-view />
    </main>
    <Toast position="bottom-center" />
    <ConfirmDialog />
    <ShortcutsHelp v-model:visible="helpOpen" />
  </div>
</template>
