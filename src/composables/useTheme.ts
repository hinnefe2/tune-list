import { computed, ref, watch } from 'vue'

export type ThemePref = 'light' | 'dark'

const STORAGE_KEY = 'tune-list:theme'

const pref = ref<ThemePref>('light')
let initialized = false

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyToDom() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', pref.value === 'dark')
  // PrimeVue's color-scheme honoring uses CSS color-scheme on :root for some
  // form controls; matching it stops the browser from forcing a light scrollbar.
  document.documentElement.style.colorScheme = pref.value
}

/** Call once at app startup, before mount, so the first paint is correct. */
export function initTheme() {
  if (initialized) return
  initialized = true
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (stored === 'light' || stored === 'dark') {
    pref.value = stored
  } else {
    pref.value = systemPrefersDark() ? 'dark' : 'light'
  }
  applyToDom()
  watch(pref, (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, v)
    } catch {
      /* private mode, etc. */
    }
    applyToDom()
  })
}

export function useTheme() {
  const isDark = computed(() => pref.value === 'dark')
  function toggle() {
    pref.value = pref.value === 'dark' ? 'light' : 'dark'
  }
  function set(next: ThemePref) {
    pref.value = next
  }
  return { pref, isDark, toggle, set }
}
