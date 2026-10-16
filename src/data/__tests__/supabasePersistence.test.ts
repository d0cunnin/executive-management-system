import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { SupabasePersistence } from '../supabasePersistence'

/** Minimal stand-in for the Supabase client: per-table select results. */
function fakeClient(results: Record<string, { data?: unknown[]; error?: { code?: string; message: string } }>, writes: { table: string; rows: unknown }[] = []) {
  return {
    from(table: string) {
      return {
        select: async () => results[table] ?? { data: [], error: null },
        upsert: async (rows: unknown) => {
          writes.push({ table, rows })
          return { error: null }
        },
      }
    },
  } as unknown as SupabaseClient
}

describe('Supabase persistence', () => {
  it('keeps EMS working when the Content Studio tables are not created yet', async () => {
    const p = new SupabasePersistence(
      fakeClient({
        ems_areas: { data: [{ data: { id: 'area_dbm' } }] },
        ems_content_revisions: { error: { code: 'PGRST205', message: 'Could not find the table' } },
      }),
      'u1',
    )
    const db = await p.load()
    expect(db?.areas).toHaveLength(1)
    expect(db?.contentRevisions).toEqual([])
    expect(p.missing).toEqual(['ems_content_revisions'])
    await expect(p.saveCollection('contentRevisions', [], ['x'], [])).rejects.toThrow(/aren’t set up yet/)
  })

  it('still fails loudly when an original table cannot be read', async () => {
    const p = new SupabasePersistence(fakeClient({ ems_projects: { error: { code: '42501', message: 'permission denied for table ems_projects' } } }), 'u1')
    await expect(p.load()).rejects.toThrow(/permission denied/)
  })

  it('writes the indexed campaign and content columns only where they exist', async () => {
    const writes: { table: string; rows: unknown }[] = []
    const p = new SupabasePersistence(fakeClient({}, writes), 'u1')
    await p.load()
    const now = new Date().toISOString()
    await p.saveCollection('content', [{ id: 'c1', createdAt: now, updatedAt: now, campaignId: 'k1' } as never], ['c1'], [])
    await p.saveCollection('projects', [{ id: 'p1', createdAt: now, updatedAt: now } as never], ['p1'], [])
    expect((writes[0].rows as Record<string, unknown>[])[0].campaign_id).toBe('k1')
    expect((writes[1].rows as Record<string, unknown>[])[0]).not.toHaveProperty('campaign_id')
  })
})
