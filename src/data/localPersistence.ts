import type { BaseRecord, CollectionName, DB } from '../domain/types'
import type { Persistence } from './store'

const KEY = 'ems.db.v1'

/** Keeps everything in this browser. Used whenever Supabase is not configured. */
export class LocalPersistence implements Persistence {
  readonly kind = 'local' as const
  private db: DB | null = null

  async load(): Promise<DB | null> {
    try {
      const raw = localStorage.getItem(KEY)
      this.db = raw ? (JSON.parse(raw) as DB) : null
    } catch {
      this.db = null
    }
    return this.db
  }

  async saveCollection(name: CollectionName, records: BaseRecord[]) {
    this.db = { ...(this.db ?? ({} as DB)), [name]: records } as DB
    this.write()
  }

  async saveAll(db: DB) {
    this.db = db
    this.write()
  }

  private write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.db))
    } catch {
      // Storage full or blocked (private mode). The app keeps working in memory.
    }
  }
}
