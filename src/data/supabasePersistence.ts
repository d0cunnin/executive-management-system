import type { SupabaseClient } from '@supabase/supabase-js'
import type { BaseRecord, CollectionName, DB } from '../domain/types'
import type { Persistence } from './store'

/** Table name for each collection (see supabase/migrations). */
export const TABLES: Record<CollectionName, string> = {
  areas: 'ems_areas',
  learningAreas: 'ems_learning_areas',
  projects: 'ems_projects',
  milestones: 'ems_milestones',
  tasks: 'ems_tasks',
  ongoing: 'ems_ongoing_work',
  goals: 'ems_goals',
  campaigns: 'ems_campaigns',
  events: 'ems_events',
  ideas: 'ems_ideas',
  income: 'ems_income',
  offers: 'ems_offers',
  content: 'ems_content',
  assets: 'ems_assets',
  contacts: 'ems_contacts',
  notes: 'ems_notes',
  links: 'ems_links',
  wellness: 'ems_wellness',
  agents: 'ems_agents',
  actions: 'ems_ai_actions',
  notifications: 'ems_notifications',
  progress: 'ems_progress',
  captures: 'ems_captures',
}

type Row = { id: string; user_id: string; data: Record<string, unknown>; area_id: string | null; project_id: string | null; status: string | null; updated_at: string }

function toRow(userId: string, r: Record<string, unknown>): Row {
  return {
    id: r.id as string,
    user_id: userId,
    data: r,
    area_id: (r.areaId as string) ?? null,
    project_id: (r.projectId as string) ?? null,
    status: (r.status as string) ?? (r.state as string) ?? null,
    updated_at: (r.updatedAt as string) ?? new Date().toISOString(),
  }
}

/**
 * Stores each collection in its own Postgres table. Every row keeps the full
 * record in `data` plus indexed columns for the fields queries filter on.
 * Row-level security limits every table to the signed-in user.
 */
export class SupabasePersistence implements Persistence {
  readonly kind = 'supabase' as const
  private client: SupabaseClient
  private userId: string
  constructor(client: SupabaseClient, userId: string) {
    this.client = client
    this.userId = userId
  }

  async load(): Promise<DB | null> {
    const names = Object.keys(TABLES) as CollectionName[]
    const results = await Promise.all(names.map((n) => this.client.from(TABLES[n]).select('data')))
    const db = {} as Record<CollectionName, unknown[]>
    let total = 0
    results.forEach((res, i) => {
      if (res.error) throw new Error(res.error.message)
      db[names[i]] = (res.data ?? []).map((row: { data: unknown }) => row.data)
      total += db[names[i]].length
    })
    return total === 0 ? null : (db as unknown as DB)
  }

  async saveCollection(name: CollectionName, records: BaseRecord[], changedIds: string[], removedIds: string[]) {
    const table = TABLES[name]
    const changed = (records as unknown as Record<string, unknown>[]).filter((r) => changedIds.includes(r.id as string))
    if (changed.length) {
      const { error } = await this.client.from(table).upsert(changed.map((r) => toRow(this.userId, r)), { onConflict: 'user_id,id' })
      if (error) throw new Error(error.message)
    }
    if (removedIds.length) {
      const { error } = await this.client.from(table).delete().eq('user_id', this.userId).in('id', removedIds)
      if (error) throw new Error(error.message)
    }
  }

  async saveAll(db: DB) {
    for (const name of Object.keys(TABLES) as CollectionName[]) {
      const table = TABLES[name]
      const del = await this.client.from(table).delete().eq('user_id', this.userId)
      if (del.error) throw new Error(del.error.message)
      const rows = (db[name] as unknown as Record<string, unknown>[]).map((r) => toRow(this.userId, r))
      if (rows.length) {
        const { error } = await this.client.from(table).insert(rows)
        if (error) throw new Error(error.message)
      }
    }
  }
}
