import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export interface AuthUser {
  id: string
  email?: string
}

interface AuthState {
  mode: 'supabase' | 'demo'
  user: AuthUser | null
  loading: boolean
  signIn(email: string, password: string): Promise<string | null>
  signUp(email: string, password: string): Promise<string | null>
  enterDemo(): void
  signOut(): Promise<void>
}

const AuthCtx = createContext<AuthState | null>(null)
const DEMO_KEY = 'ems.demo.session'
const DEMO_USER: AuthUser = { id: 'demo-user' }

function readDemo(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === '1'
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = supabase ? 'supabase' : 'demo'
  const [user, setUser] = useState<AuthUser | null>(mode === 'demo' && readDemo() ? DEMO_USER : null)
  const [loading, setLoading] = useState(mode === 'supabase')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? { id: data.session.user.id, email: data.session.user.email } : null)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session ? { id: session.user.id, email: session.user.email } : null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value: AuthState = {
    mode,
    user,
    loading,
    async signIn(email, password) {
      if (!supabase) return 'Supabase is not configured.'
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error?.message ?? null
    },
    async signUp(email, password) {
      if (!supabase) return 'Supabase is not configured.'
      const { error } = await supabase.auth.signUp({ email, password })
      return error?.message ?? 'Check your email to confirm your account, then sign in.'
    },
    enterDemo() {
      try {
        localStorage.setItem(DEMO_KEY, '1')
      } catch {
        // Private mode: stay signed in for this tab only.
      }
      setUser(DEMO_USER)
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut()
      try {
        localStorage.removeItem(DEMO_KEY)
      } catch {
        // ignore
      }
      setUser(null)
    },
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(AuthCtx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
