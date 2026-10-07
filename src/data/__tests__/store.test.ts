import { describe, expect, it } from 'vitest'
import type { BaseRecord, CollectionName, DB } from '../../domain/types'
import { AREAS, buildSeed } from '../seed'
import { Store, type Persistence } from '../store'

class MemoryPersistence implements Persistence {
  readonly kind = 'local' as const
  removed: Record<string, string[]> = {}
  async load() {
    return null
  }
  async saveCollection(name: CollectionName, _records: BaseRecord[], _changed: string[], removedIds: string[]) {
    this.removed[name] = [...(this.removed[name] ?? []), ...removedIds]
  }
  async saveAll(_db: DB) {}
}

describe('clear sample data', () => {
  it('removes sample records and what hangs off them, keeps her own work', async () => {
    const p = new MemoryPersistence()
    const store = new Store(p)
    await store.init()
    const mine = store.create('events', { title: 'My real meeting', kind: 'meeting', start: '2026-10-20' })
    const myProject = store.create('projects', { name: 'Real project', outcome: 'x', areaId: 'area_dbm', status: 'active', cadence: 'none', progress: 0, lastActivityAt: new Date().toISOString() })
    const onSample = store.create('tasks', { title: 'Added to a sample project', status: 'todo', mode: 'me', projectId: 'p_summit_reg', importance: 3 })

    expect(store.sampleCount()).toBeGreaterThan(0)
    await store.clearSampleData()

    expect(store.sampleCount()).toBe(0)
    expect(store.all('events').map((e) => e.id)).toEqual([mine.id])
    expect(store.get('projects', myProject.id)).toBeDefined()
    expect(store.get('tasks', onSample.id)).toBeUndefined()
    expect(store.all('areas').length).toBe(AREAS.length)
    expect(store.all('agents').length).toBeGreaterThan(0)
    expect(p.removed.events).toContain('e1')
  })
})

describe('built-in areas', () => {
  it('adds Nursing School to an account saved before it existed, keeping her data', async () => {
    const old = buildSeed()
    old.areas = old.areas.filter((a) => a.id !== 'area_nursing')
    old.agents = old.agents.filter((a) => a.key !== 'study')
    const saved: string[] = []
    const p: Persistence = {
      kind: 'local',
      load: async () => old,
      saveCollection: async (_n, _r, changed) => {
        saved.push(...changed)
      },
      saveAll: async () => {},
    }
    const store = new Store(p)
    await store.init()
    expect(store.get('areas', 'area_nursing')?.name).toBe('Nursing School')
    expect(store.all('agents').some((a) => a.key === 'study')).toBe(true)
    expect(saved).toContain('area_nursing')
    expect(store.all('projects').length).toBe(old.projects.length)
  })
})
