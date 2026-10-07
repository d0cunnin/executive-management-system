// The EMS store: an in-memory database with pluggable persistence.
// Screens read through hooks (data/hooks.ts) and write through these methods,
// so swapping localStorage for Supabase never touches UI code.
import type { BaseRecord, CollectionName, Collections, DB, ProgressEntry } from '../domain/types'
import { nowIso, uid } from '../lib/util'
import { AGENTS, AREAS, buildSeed } from './seed'

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
        await this.addMissingBuiltins()
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

  /**
   * Areas and assistants added to EMS after an account was created (for
   * example Nursing School) are added on load, without touching her data.
   */
  private async addMissingBuiltins() {
    const now = nowIso()
    const areas = AREAS.filter((a) => !this.db.areas.some((x) => x.id === a.id))
    if (areas.length) {
      this.db = { ...this.db, areas: [...this.db.areas, ...areas] }
      await this.persistence.saveCollection('areas', this.db.areas, areas.map((a) => a.id), [])
    }
    const agents = AGENTS.filter((a) => !this.db.agents.some((x) => x.key === a.key)).map((a) => ({ ...a, id: `agent_${a.key}`, createdAt: now, updatedAt: now }))
    if (agents.length) {
      this.db = { ...this.db, agents: [...this.db.agents, ...agents] }
      await this.persistence.saveCollection('agents', this.db.agents, agents.map((a) => a.id), [])
    }
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

  /** How many sample (demo) records are still in the system. */
  sampleCount(): number {
    return (Object.keys(this.db) as CollectionName[]).reduce((n, k) => n + (this.db[k] as BaseRecord[]).filter((r) => r.demo).length, 0)
  }

  /**
   * Remove every sample record, plus anything attached to a sample record
   * (for example a to-do added to a sample project). Areas, the AI team and
   * everything D'Andrea created on her own are kept.
   */
  async clearSampleData(): Promise<number> {
    const names = Object.keys(this.db) as CollectionName[]
    const removed = new Set<string>()
    for (const k of names) for (const r of this.db[k] as BaseRecord[]) if (r.demo) removed.add(r.id)
    const refs = ['projectId', 'taskId', 'campaignId', 'goalId', 'offerId', 'fromId', 'toId'] as const
    const attached = (r: BaseRecord) => refs.some((f) => removed.has((r as unknown as Record<string, string>)[f]))
    // Repeat until stable so chains (sample project -> my to-do -> AI draft) go together.
    for (let changed = true; changed; ) {
      changed = false
      for (const k of names)
        for (const r of this.db[k] as BaseRecord[])
          if (!removed.has(r.id) && attached(r)) {
            removed.add(r.id)
            changed = true
          }
    }
    const next = { ...this.db }
    const failures: string[] = []
    for (const k of names) {
      const list = this.db[k] as BaseRecord[]
      const gone = list.filter((r) => removed.has(r.id)).map((r) => r.id)
      if (!gone.length) continue
      const kept = list.filter((r) => !removed.has(r.id))
      ;(next as Record<string, BaseRecord[]>)[k] = kept
      try {
        await this.persistence.saveCollection(k, kept, [], gone)
      } catch (e) {
        failures.push(e instanceof Error ? e.message : String(e))
      }
    }
    this.db = next
    this.error = failures.length ? `Some sample data could not be removed: ${failures[0]}` : null
    this.emit()
    return removed.size
  }

  async reset() {
    this.db = buildSeed()
    await this.persistence.saveAll(this.db)
    this.emit()
  }
}
