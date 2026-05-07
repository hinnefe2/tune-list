import { ref, watch, type Ref } from 'vue'

/**
 * Mirror a boolean ref but only flip true after `delay` ms of continuous truth.
 * Used for skeleton/loading states: a fast (sub-delay) load never triggers the
 * skeleton, so the user sees content appear directly instead of a flash.
 */
export function useDelayed(source: Ref<boolean>, delay = 300): Ref<boolean> {
  const out = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function clear() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  watch(
    source,
    (v) => {
      clear()
      if (v) {
        timer = setTimeout(() => {
          out.value = true
        }, delay)
      } else {
        out.value = false
      }
    },
    { immediate: true },
  )

  return out
}
