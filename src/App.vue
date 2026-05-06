<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppHeader from '@/components/AppHeader.vue'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'

const auth = useAuthStore()
const route = useRoute()

const showHeader = computed(() => auth.isSignedIn && route.name !== 'login')
</script>

<template>
  <div class="min-h-full flex flex-col">
    <AppHeader v-if="showHeader" />
    <main class="flex-1">
      <router-view />
    </main>
    <Toast position="bottom-center" />
    <ConfirmDialog />
  </div>
</template>
