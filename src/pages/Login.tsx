import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { mode, signIn, signUp, enterDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="glass rise w-full max-w-md p-7 sm:p-9">
        <p className="label">Executive Management System</p>
        <h1 className="display mt-2 text-4xl leading-tight">D’Andrea Bolden</h1>
        <p className="mt-2 text-sm text-muted">You provide the vision. EMS helps move it forward.</p>

        {mode === 'supabase' ? (
          <form
            className="mt-8 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setMsg(await signIn(email, password))
              setBusy(false)
            }}
          >
            <input className="input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="input" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {msg && <p className="text-xs text-amber-200">{msg}</p>}
            <button className="btn-primary w-full justify-center" disabled={busy}>
              Sign in
            </button>
            <button
              type="button"
              className="w-full text-xs text-muted hover:text-white"
              onClick={async () => {
                setBusy(true)
                setMsg(await signUp(email, password))
                setBusy(false)
              }}
            >
              First time? Create the account
            </button>
          </form>
        ) : (
          <div className="mt-8 space-y-3">
            <button className="btn-primary w-full justify-center py-3" onClick={enterDemo}>
              Enter EMS
            </button>
            <p className="text-xs leading-relaxed text-muted">
              Demo mode: sign-in is not configured yet, so there is no password and your data stays in this browser. Connect Supabase (see README) for secure sign-in and cloud storage.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
