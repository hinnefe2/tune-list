import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function hasModifier(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey || e.altKey
}

/**
 * Bind a single-key shortcut to window. Skipped when focus is in an editable
 * element, when any modifier is held, or on key auto-repeat.
 */
export function useShortcut(key: string, handler: (e: KeyboardEvent) => void) {
  function onKeydown(e: KeyboardEvent) {
    if (e.repeat) return
    if (e.key !== key) return
    if (hasModifier(e)) return
    if (isEditableTarget(e.target)) return
    handler(e)
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}

const NAV_KEYS: Record<string, string> = {
  t: 'tunes',
  c: 'capture',
  l: 'learn',
  p: 'practice',
}

const LEADER_TIMEOUT_MS = 1000

/**
 * Global navigation shortcuts: "g" leader (g→t/c/l/p for pages, g→g for top
 * of page) and "G" (Shift+g) for bottom of page. Install once at the app root.
 *
 * While the leader is active, the follow-up keypress is consumed (default
 * prevented + propagation stopped) so sequences like "ga" don't fall through
 * to page-level single-key shortcuts.
 */
export function useNavShortcuts() {
  const router = useRouter()
  let leaderActive = false
  let leaderTimer: ReturnType<typeof setTimeout> | null = null

  function clearLeader() {
    leaderActive = false
    if (leaderTimer) {
      clearTimeout(leaderTimer)
      leaderTimer = null
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.repeat) return
    if (hasModifier(e)) {
      clearLeader()
      return
    }
    if (isEditableTarget(e.target)) {
      clearLeader()
      return
    }
    if (leaderActive) {
      clearLeader()
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.key === 'g') {
        window.scrollTo({ top: 0 })
        return
      }
      const route = NAV_KEYS[e.key]
      if (route) router.push({ name: route })
      return
    }
    if (e.key === 'G') {
      e.preventDefault()
      window.scrollTo({ top: document.documentElement.scrollHeight })
      return
    }
    if (e.key === 'g') {
      leaderActive = true
      leaderTimer = setTimeout(clearLeader, LEADER_TIMEOUT_MS)
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    clearLeader()
  })
}
