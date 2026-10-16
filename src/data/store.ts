// The EMS store: an in-memory database with pluggable persistence.
// Screens read through hooks (data/hooks.ts) and write through these methods,
// so swapping localStorage for Supabase never touches UI code.
import type { BaseRecord, CollectionName, Collections, DB, ProgressEntry } from '../domain/types'
import { nowIso, uid } from '../lib/util'
import { normalizeContent } from '../domain/content'
import { AGENTS, AREAS, buildSeed } from './seed'

export interface Persistence {
  readonly kind: 'local' | 'supabase'
  /** Tables that don't exist yet in the database (Supabase only). */
  readonly missing?: string[]
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
  contentRevisions: [], contentEvents: [], campaignMetrics: [], brandSettings: [],
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
        // Older content used other status names; map them in memory only.
        this.db = { ...this.db, content: this.db.content.map(normalizeContent) }
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
    // Assistants that already exist gain any new built-in skills; nothing is removed.
    const grown = this.db.agents
      .map((x) => {
        const def = AGENTS.find((a) => a.key === x.key)
        const extra = def?.skills.filter((sk) => !x.skills.includes(sk)) ?? []
        return extra.length ? { ...x, skills: [...x.skills, ...extra], updatedAt: now } : null
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
    if (grown.length) {
      this.db = { ...this.db, agents: this.db.agents.map((x) => grown.find((g) => g.id === x.id) ?? x) }
      await this.persistence.saveCollection('agents', this.db.agents, grown.map((g) => g.id), [])
    }
    const agents = AGENTS.filter((a) => !this.db.agents.some((x) => x.key === a.key)).map((a) => ({ ...a, id: `agent_${a.key}`, createdAt: now, updatedAt: now }))
    if (agents.length) {
      this.db = { ...this.db, agents: [...this.db.agents, ...agents] }
      await this.persistence.saveCollection('agents', this.db.agents, agents.map((a) => a.id), [])
    }
  }

  /** Database tables the Content Studio needs that don't exist yet. */
  get setupMissing(): string[] {
    return this.persistence.missing ?? []
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
    const entry = this.pending.get(name) ?? { changed: new Set<string>(), removed: new Set<string>() }
    for (const id of changed) {
      entry.changed.add(id)
      entry.removed.delete(id)
    }
    for (const id of removed) {
      entry.removed.add(id)
      entry.changed.delete(id)
    }
    this.pending.set(name, entry)
    void this.flush()
  }

  // ── Save queue ─────────────────────────────────────────────────────────
  // Changes wait here until the database confirms them. If the connection
  // drops, they stay queued and are retried, so nothing is silently lost.

  private pending = new Map<CollectionName, { changed: Set<string>; removed: Set<string> }>()
  private flushing = false
  private again = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retries = 0
  /** True while changes are waiting because the server couldn't be reached. */
  offline = false

  /** Changes not yet confirmed by the database. */
  get unsavedCount(): number {
    let n = 0
    for (const e of this.pending.values()) n += e.changed.size + e.removed.size
    return n
  }

  /** Try saving queued changes now (for example from a "Try now" button). */
  retryNow = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    void this.flush()
  }

  private async flush(): Promise<void> {
    if (this.flushing) {
      this.again = true
      return
    }
    this.flushing = true
    try {
      do {
        this.again = false
        for (const [name, entry] of [...this.pending]) {
          const records = this.all(name) as BaseRecord[]
          const changed = [...entry.changed].filter((id) => records.some((r) => r.id === id))
          const removed = [...entry.removed]
          // Take ownership of these ids; anything changed meanwhile is re-queued.
          this.pending.delete(name)
          try {
            if (changed.length || removed.length) await this.persistence.saveCollection(name, records, changed, removed)
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            if (isNetworkError(message)) {
              const back = this.pending.get(name) ?? { changed: new Set<string>(), removed: new Set<string>() }
              for (const id of changed) if (!back.removed.has(id)) back.changed.add(id)
              for (const id of removed) if (!back.changed.has(id)) back.removed.add(id)
              this.pending.set(name, back)
              this.offline = true
              this.error = null
              this.scheduleRetry()
              this.emit()
              return
            }
            // A real refusal (for example a permission rule): retrying won't help.
            this.error = `Could not save: ${message}`
            this.emit()
          }
        }
      } while (this.again || (this.pending.size > 0 && !this.offline))
      if (this.offline) {
        this.offline = false
        this.retries = 0
        this.emit()
      }
    } finally {
      this.flushing = false
    }
  }

  private scheduleRetry() {
    if (this.retryTimer) return
    const delays = [2000, 5000, 10000, 20000, 30000, 60000]
    const wait = delays[Math.min(this.retries, delays.length - 1)]
    this.retries += 1
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.flush()
    }, wait)
  }

  /** Retry as soon as the device is back online or the tab is visible again. */
  watchConnection(): () => void {
    if (typeof window === 'undefined') return () => {}
    const kick = () => {
      if (this.unsavedCount) this.retryNow()
    }
    const onVisible = () => document.visibilityState === 'visible' && kick()
    // Closing the tab with changes still waiting would lose them: ask first.
    const onLeave = (e: BeforeUnloadEvent) => {
      if (this.unsavedCount) e.preventDefault()
    }
    window.addEventListener('online', kick)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('online', kick)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('beforeunload', onLeave)
    }
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

  /**
   * Like create/update, but waits for the database. If saving fails the
   * change is undone and the error is thrown, so the screen never shows
   * something (an approval, say) that didn't actually save.
   */
  async createConfirmed<K extends CollectionName>(name: K, data: Omit<Collections[K], keyof BaseRecord> & Partial<BaseRecord>): Promise<Collections[K]> {
    const before = this.all(name)
    const now = nowIso()
    const record = { id: uid(name.slice(0, 3)), createdAt: now, updatedAt: now, ...data } as Collections[K]
    const next = [...before, record]
    this.db = { ...this.db, [name]: next }
    this.emit()
    try {
      await this.persistence.saveCollection(name, next, [record.id], [])
    } catch (e) {
      this.db = { ...this.db, [name]: before }
      this.emit()
      throw e
    }
    return record
  }

  async updateConfirmed<K extends CollectionName>(name: K, id: string, patch: Partial<Collections[K]>): Promise<Collections[K]> {
    const before = this.all(name)
    let updated: Collections[K] | undefined
    const next = before.map((r) => {
      if (r.id !== id) return r
      updated = { ...r, ...patch, updatedAt: nowIso() }
      return updated
    })
    if (!updated) throw new Error('That record no longer exists.')
    this.db = { ...this.db, [name]: next }
    this.emit()
    try {
      await this.persistence.saveCollection(name, next, [id], [])
    } catch (e) {
      this.db = { ...this.db, [name]: before }
      this.emit()
      throw e
    }
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

/** The browser couldn't reach the server at all (as opposed to the server saying no). */
export function isNetworkError(message: string): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_network|err_internet_disconnected/i.test(message)
}
