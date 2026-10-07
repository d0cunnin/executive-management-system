import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { BuiltinProvider, EdgeFunctionProvider, type AIProvider } from '../ai/provider'
import { useAuth } from '../auth/AuthContext'
import { LocalPersistence } from '../data/localPersistence'
import { Store } from '../data/store'
import { SupabasePersistence } from '../data/supabasePersistence'
import type { DB } from '../domain/types'
import { aiEnabled, supabase } from '../lib/supabase'

interface EMS {
  store: Store
  ai: AIProvider
}

const Ctx = createContext<EMS | null>(null)

export function EMSProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? 'anon'
  const [attempt, setAttempt] = useState(0)
  const ems = useMemo<EMS>(() => {
    const persistence = supabase && userId !== 'demo-user' && userId !== 'anon' ? new SupabasePersistence(supabase, userId) : new LocalPersistence()
    const ai = aiEnabled && supabase ? new EdgeFunctionProvider(supabase) : new BuiltinProvider()
    return { store: new Store(persistence), ai }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, attempt])
  const [readyFor, setReadyFor] = useState<Store | null>(null)

  useEffect(() => {
    let live = true
    ems.store.init().then(() => live && setReadyFor(ems.store))
    return () => {
      live = false
    }
  }, [ems])

  if (readyFor === ems.store && ems.store.loadError) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="glass max-w-md p-6">
          <p className="label">Couldn’t open your EMS</p>
          <p className="mt-2 text-sm text-white">Your information couldn’t be loaded, so nothing would be saved. Nothing has been changed.</p>
          <p className="mt-3 rounded-lg bg-ink-950/60 p-2 font-mono text-xs text-amber-200">{ems.store.loadError}</p>
          {/permission denied/i.test(ems.store.loadError) && (
            <p className="mt-3 text-xs text-muted">The database hasn’t given the app access to its tables yet. Run the “grant access” SQL from supabase/migrations in the Supabase SQL Editor, then try again.</p>
          )}
          <button className="btn-primary mt-4" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      </div>
    )
  }
  if (readyFor !== ems.store) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="label animate-pulse">Opening your EMS</p>
      </div>
    )
  }
  return <Ctx.Provider value={ems}>{children}</Ctx.Provider>
}

export function useEMS(): EMS {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEMS must be used inside EMSProvider')
  return v
}

/** Live view of the whole database. Re-renders on any change. */
export function useDB(): DB {
  const { store } = useEMS()
  return useSyncExternalStore(store.subscribe, store.snapshot)
}
