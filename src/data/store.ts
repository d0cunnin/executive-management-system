// The EMS store: an in-memory database with pluggable persistence.
// Screens read through hooks (data/hooks.ts) and write through these methods,
// so swapping localStorage for Supabase never touches UI code.
import type { BaseRecord, CollectionName, Collections, DB, ProgressEntry } from '../domain/types'
import { nowIso, uid } from '../lib/util'
import { buildSeed } from './seed'

export interface Persistence {
  readonly kind: 'local' | 'supabase'
  load(): Promise<DB | null>
  /** Called after every change with the changed collection's records. */
  saveCollection(name: CollectionName, records: BaseRecord[], changedIds: string[], removedIds: string[]): Promise<void>
  /** Replace everything (used by reset). */
  saveAll(db: DB): Promise<void>
}

type Listener = () => void

const EMPTY: DB = {
  areas: [], learningAreas: [], projects: [], milestones: [], tasks: [], ongoing: [], goals: [], campaigns: [],
  events: [], ideas: [], income: [], offers: [], content: [], assets: [], contacts: [], notes: [], links: [],
  wellness: [], agents: [], actions: [], notifications: [], progress: [], captures: [],
}

export class Store {
  private db: DB = EMPTY
  private listeners = new Set<Listener>()
  ready = false
  error: string | null = null
  /** Set when saved data could not be loaded. The app must not pretend to work. */
  loadError: string | null = null

  readonly persistence: Persistence
  constructor(persistence: Persistence) {
    this.persistence = persistence
  }

  async init(): Promise<void> {
    try {
      const loaded = await this.persistence.load()
      if (loaded) {
        // Fill any collections added since the data was saved.
        this.db = { ...EMPTY, ...loaded }
      } else {
        this.db = buildSeed()
        await this.persistence.saveAll(this.db)
      }
    } catch (e) {
      // Never fall back to sample data here: changes would look saved but not be.
      this.loadError = e instanceof Error ? e.message : String(e)
    }
    this.ready = true
    this.emit()
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  snapshot = (): DB => this.db

  private emit() {
    for (const l of this.listeners) l()
  }

  private commit<K extends CollectionName>(name: K, records: Collections[K][], changed: string[], removed: string[] = []) {
    this.db = { ...this.db, [name]: records }
    this.emit()
    this.persistence.saveCollection(name, records, changed, removed).catch((e) => {
      this.error = `Could not save: ${e instanceof Error ? e.message : String(e)}`
      this.emit()
    })
  }

  all<K extends CollectionName>(name: K): Collections[K][] {
    return this.db[name] as Collections[K][]
  }

  get<K extends CollectionName>(name: K, id: string): Collections[K] | undefined {
    return this.all(name).find((r) => r.id === id)
  }

  create<K extends CollectionName>(name: K, data: Omit<Collections[K], keyof BaseRecord> & Partial<BaseRecord>): Collections[K] {
    const now = nowIso()
    const record = { id: uid(name.slice(0, 3)), createdAt: now, updatedAt: now, ...data } as Collections[K]
    this.commit(name, [...this.all(name), record], [record.id])
    return record
  }

  update<K extends CollectionName>(name: K, id: string, patch: Partial<Collections[K]>): Collections[K] | undefined {
    let updated: Collections[K] | undefined
    const next = this.all(name).map((r) => {
      if (r.id !== id) return r
      updated = { ...r, ...patch, updatedAt: nowIso() }
      return updated
    })
    if (updated) this.commit(name, next, [id])
    return updated
  }

  remove<K extends CollectionName>(name: K, id: string) {
    this.commit(name, this.all(name).filter((r) => r.id !== id), [], [id])
  }

  /** Record meaningful progress for WHAT MOVED FORWARD. */
  logProgress(entry: Omit<ProgressEntry, keyof BaseRecord | 'at'>) {
    this.create('progress', { ...entry, at: nowIso() })
  }

  async reset() {
    this.db = buildSeed()
    await this.persistence.saveAll(this.db)
    this.emit()
  }
}
