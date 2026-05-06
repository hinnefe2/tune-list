import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'

export interface Profile {
  id: string
  display_name: string | null
  created_at: string
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(null)
  const ready = ref(false)

  const isSignedIn = computed(() => session.value !== null)

  async function loadProfile(uid: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, created_at')
      .eq('id', uid)
      .maybeSingle()
    if (error) {
      console.error('Failed to load profile', error)
      return
    }
    profile.value = (data as Profile | null) ?? null
  }

  async function init() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    if (user.value) await loadProfile(user.value.id)

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
      if (user.value) {
        void loadProfile(user.value.id)
      } else {
        profile.value = null
      }
    })

    ready.value = true
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { session, user, profile, ready, isSignedIn, init, signInWithGoogle, signOut }
})
