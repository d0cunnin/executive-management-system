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
  contentRevisions: 'ems_content_revisions',
  contentEvents: 'ems_content_events',
  campaignMetrics: 'ems_campaign_metrics',
  brandSettings: 'ems_brand_settings',
}

/**
 * Collections added after the first release. If their tables don't exist yet
 * (migration not run), the rest of EMS keeps working and the Studio says so.
 */
export const OPTIONAL: CollectionName[] = ['contentRevisions', 'contentEvents', 'campaignMetrics', 'brandSettings']

/** Extra indexed columns, only on tables that have them (see migrations). */
const EXTRA_COLUMNS: Partial<Record<CollectionName, ('campaign_id' | 'content_id')[]>> = {
  content: ['campaign_id'],
  contentRevisions: ['content_id'],
  contentEvents: ['content_id'],
  campaignMetrics: ['campaign_id'],
}

const isMissingTable = (e: { code?: string; message?: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || e.code === '42501' || /does not exist|could not find the table|permission denied/i.test(e.message ?? '')


type Row = { id: string; user_id: string; data: Record<string, unknown>; area_id: string | null; project_id: string | null; status: string | null; updated_at: string; campaign_id?: string | null; content_id?: string | null }

function toRow(userId: string, r: Record<string, unknown>, name?: CollectionName): Row {
  const row: Row = {
    id: r.id as string,
    user_id: userId,
    data: r,
    area_id: (r.areaId as string) ?? null,
    project_id: (r.projectId as string) ?? null,
    status: (r.status as string) ?? (r.state as string) ?? null,
    updated_at: (r.updatedAt as string) ?? new Date().toISOString(),
  }
  for (const col of (name && EXTRA_COLUMNS[name]) || []) row[col] = ((col === 'campaign_id' ? r.campaignId : r.contentId) as string) ?? null
  return row
}

/**
 * Stores each collection in its own Postgres table. Every row keeps the full
 * record in `data` plus indexed columns for the fields queries filter on.
 * Row-level security limits every table to the signed-in user.
 */
export class SupabasePersistence implements Persistence {
  readonly kind = 'supabase' as const
  /** Tables the database doesn't have yet. */
  missing: string[] = []
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
    this.missing = []
    results.forEach((res, i) => {
      if (res.error && OPTIONAL.includes(names[i]) && isMissingTable(res.error)) {
        this.missing.push(TABLES[names[i]])
        db[names[i]] = []
        return
      }
      if (res.error) throw new Error(res.error.message)
      db[names[i]] = (res.data ?? []).map((row: { data: unknown }) => row.data)
      total += db[names[i]].length
    })
    return total === 0 ? null : (db as unknown as DB)
  }

  async saveCollection(name: CollectionName, records: BaseRecord[], changedIds: string[], removedIds: string[]) {
    const table = TABLES[name]
    if (this.missing.includes(table)) throw new Error(`The Content Studio database tables aren’t set up yet (${table}). Run the Content Studio migration in Supabase.`)
    const changed = (records as unknown as Record<string, unknown>[]).filter((r) => changedIds.includes(r.id as string))
    if (changed.length) {
      const { error } = await this.client.from(table).upsert(changed.map((r) => toRow(this.userId, r, name)), { onConflict: 'user_id,id' })
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
      if (this.missing.includes(table)) continue
      const del = await this.client.from(table).delete().eq('user_id', this.userId)
      if (del.error) throw new Error(del.error.message)
      const rows = (db[name] as unknown as Record<string, unknown>[]).map((r) => toRow(this.userId, r, name))
      if (rows.length) {
        const { error } = await this.client.from(table).insert(rows)
        if (error) throw new Error(error.message)
      }
    }
  }
}
