import { useState } from 'react'
import { useAuth, type AuthResult } from '../auth/AuthContext'
import { cn } from '../lib/util'

type Tab = 'signin' | 'signup' | 'reset'

export default function Login() {
  const auth = useAuth()
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [result, setResult] = useState<AuthResult | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<AuthResult>) => {
    setBusy(true)
    setResult(null)
    setResult(await fn())
    setBusy(false)
  }
  const switchTab = (t: Tab) => {
    setTab(t)
    setResult(null)
    setConfirm('')
  }

  const message = result?.message && (
    <p role="status" className={cn('rounded-xl border px-3 py-2.5 text-sm', result.ok ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/30 bg-amber-400/10 text-amber-100')}>
      {result.message}
    </p>
  )

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="glass rise w-full max-w-md p-7 sm:p-9">
        <p className="label">Executive Management System</p>
        <h1 className="display mt-2 text-4xl leading-tight">D’Andrea Bolden</h1>
        <p className="mt-2 text-sm text-muted">You provide the vision. EMS helps move it forward.</p>

        {auth.mode === 'demo' ? (
          <div className="mt-8 space-y-3">
            <button className="btn-primary w-full justify-center py-3" onClick={auth.enterDemo}>
              Enter EMS
            </button>
            <p className="text-xs leading-relaxed text-muted">
              Demo mode: sign-in is not configured, so there is no password and your data stays in this browser.
            </p>
          </div>
        ) : auth.recovering ? (
          <form
            className="mt-8 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (password !== confirm) return setResult({ ok: false, message: 'The two passwords don’t match.' })
              run(() => auth.setNewPassword(password))
            }}
          >
            <p className="text-sm text-white">Choose a new password.</p>
            <input className="input" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <input className="input" type="password" autoComplete="new-password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {message}
            <button className="btn-primary w-full justify-center py-2.5" disabled={busy}>
              Save new password
            </button>
          </form>
        ) : (
          <>
            {tab !== 'reset' && (
              <div className="mt-8 grid grid-cols-2 gap-1 rounded-xl border border-line p-1" role="tablist">
                {(
                  [
                    ['signin', 'Sign in'],
                    ['signup', 'Create account'],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => switchTab(k)} className={cn('rounded-lg py-2 text-sm transition-colors', tab === k ? 'bg-glow text-white' : 'text-muted hover:text-white')}>
                    {l}
                  </button>
                ))}
              </div>
            )}

            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (tab === 'signin') run(() => auth.signIn(email, password))
                else if (tab === 'reset') run(() => auth.sendPasswordReset(email))
                else if (password !== confirm) setResult({ ok: false, message: 'The two passwords don’t match.' })
                else run(() => auth.signUp(email, password))
              }}
            >
              {tab === 'reset' && <p className="text-sm text-white">Enter your email and I’ll send a link to choose a new password.</p>}
              <input className="input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {tab !== 'reset' && (
                <input
                  className="input"
                  type="password"
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={tab === 'signup' ? 'Choose a password (8+ characters)' : 'Password'}
                  minLength={tab === 'signup' ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}
              {tab === 'signup' && (
                <input className="input" type="password" autoComplete="new-password" placeholder="Type the password again" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              )}
              {message}
              <button className="btn-primary w-full justify-center py-2.5" disabled={busy}>
                {busy ? 'One moment…' : tab === 'signin' ? 'Sign in' : tab === 'signup' ? 'Create my account' : 'Send reset link'}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-muted">
              {tab === 'reset' ? (
                <button className="hover:text-white" onClick={() => switchTab('signin')}>
                  ← Back to sign in
                </button>
              ) : (
                <button className="hover:text-white" onClick={() => switchTab('reset')}>
                  Forgot password?
                </button>
              )}
              {email && tab !== 'reset' && (
                <button className="hover:text-white" onClick={() => run(() => auth.resendConfirmation(email))}>
                  Resend confirmation email
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
