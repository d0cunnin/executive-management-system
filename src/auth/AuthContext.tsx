import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export interface AuthUser {
  id: string
  email?: string
}

/** Outcome of an auth action, worded for D'Andrea. */
export interface AuthResult {
  ok: boolean
  message?: string
}

interface AuthState {
  mode: 'supabase' | 'demo'
  user: AuthUser | null
  loading: boolean
  /** True after opening a password-reset link; the app asks for a new password. */
  recovering: boolean
  signIn(email: string, password: string): Promise<AuthResult>
  signUp(email: string, password: string): Promise<AuthResult>
  resendConfirmation(email: string): Promise<AuthResult>
  sendPasswordReset(email: string): Promise<AuthResult>
  setNewPassword(password: string): Promise<AuthResult>
  enterDemo(): void
  signOut(): Promise<void>
}

const AuthCtx = createContext<AuthState | null>(null)
const DEMO_KEY = 'ems.demo.session'
const DEMO_USER: AuthUser = { id: 'demo-user' }

/** Turn Supabase's technical errors into plain language. */
function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'That email and password don’t match an account. If you just created your account, confirm it from the email first.'
  if (m.includes('email not confirmed')) return 'Your account isn’t confirmed yet. Open the confirmation email from Supabase, or send it again below.'
  if (m.includes('already registered')) return 'There’s already an account with this email. Use Sign in instead.'
  if (m.includes('password should be') || m.includes('weak')) return 'Please choose a longer password (at least 8 characters).'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries in a short time. Please wait a minute and try again.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'New accounts are turned off in Supabase (Authentication → Sign In / Providers → allow new users to sign up).'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Couldn’t reach the sign-in service. Check your connection and try again.'
  return message
}

const redirectTo = () => `${window.location.origin}/login`

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
  // A password-reset link lands here with type=recovery in the URL hash.
  const [recovering, setRecovering] = useState(() => typeof window !== 'undefined' && window.location.hash.includes('type=recovery'))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? { id: data.session.user.id, email: data.session.user.email } : null)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setUser(session ? { id: session.user.id, email: session.user.email } : null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value: AuthState = {
    mode,
    user,
    loading,
    recovering,
    async signIn(email, password) {
      if (!supabase) return { ok: false, message: 'Sign-in is not configured.' }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error ? { ok: false, message: friendly(error.message) } : { ok: true }
    },
    async signUp(email, password) {
      if (!supabase) return { ok: false, message: 'Sign-in is not configured.' }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } })
      if (error) return { ok: false, message: friendly(error.message) }
      // Supabase hides whether an email exists; an empty identity list means it does.
      if (data.user && data.user.identities?.length === 0) return { ok: false, message: 'There’s already an account with this email. Use Sign in instead.' }
      if (data.session) return { ok: true, message: 'Your account is ready.' }
      return { ok: true, message: `Almost done. We sent a confirmation link to ${email}. Open it, then come back and sign in. (Check spam if you don’t see it in a few minutes.)` }
    },
    async resendConfirmation(email) {
      if (!supabase) return { ok: false }
      const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo() } })
      return error ? { ok: false, message: friendly(error.message) } : { ok: true, message: `Sent again to ${email}.` }
    },
    async sendPasswordReset(email) {
      if (!supabase) return { ok: false }
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() })
      return error ? { ok: false, message: friendly(error.message) } : { ok: true, message: `If there’s an account for ${email}, a reset link is on its way.` }
    },
    async setNewPassword(password) {
      if (!supabase) return { ok: false }
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return { ok: false, message: friendly(error.message) }
      setRecovering(false)
      return { ok: true, message: 'Password updated.' }
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
