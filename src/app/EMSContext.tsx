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
  const ems = useMemo<EMS>(() => {
    const persistence = supabase && userId !== 'demo-user' && userId !== 'anon' ? new SupabasePersistence(supabase, userId) : new LocalPersistence()
    const ai = aiEnabled && supabase ? new EdgeFunctionProvider(supabase) : new BuiltinProvider()
    return { store: new Store(persistence), ai }
  }, [userId])
  const [readyFor, setReadyFor] = useState<Store | null>(null)

  useEffect(() => {
    let live = true
    ems.store.init().then(() => live && setReadyFor(ems.store))
    return () => {
      live = false
    }
  }, [ems])

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
