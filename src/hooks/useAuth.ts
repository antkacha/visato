import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    // Track whether a real auth event (SIGNED_IN / SIGNED_OUT) has already
    // set the user, so the async getSession() call below never overrides it
    // with a potentially stale localStorage snapshot.
    let authEventFired = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION fires synchronously from storage — getSession() below
      // is the authoritative validated read, so we defer to it for that case.
      if (event === 'INITIAL_SESSION') return

      authEventFired = true
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    // Authoritative session on app load: reads stored token and refreshes it
    // if expired. Only applies its result if no SIGNED_IN/SIGNED_OUT event
    // has already fired (which would be more up-to-date).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (authEventFired) return
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = () => {
    if (!supabase) return
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        // Force the Google account picker every time so the user always
        // authenticates as the account they intend, not a cached one.
        queryParams: { prompt: 'select_account' },
      },
    })
  }

  const signOut = () => supabase?.auth.signOut()

  return { user, authLoading, signInWithGoogle, signOut }
}
