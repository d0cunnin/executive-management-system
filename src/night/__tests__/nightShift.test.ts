import { describe, expect, it } from 'vitest'
import type { AIProvider } from '../../ai/provider'
import { Store, type Persistence } from '../../data/store'
import type { BaseRecord, CollectionName, DB } from '../../domain/types'
import { nightQueue, runNightShift } from '../nightShift'

class Memory implements Persistence {
  readonly kind = 'local' as const
  async load() {
    return null
  }
  async saveCollection(_n: CollectionName, _r: BaseRecord[], _c: string[], _x: string[]) {}
  async saveAll(_db: DB) {}
}

const ai = (fail = false): AIProvider => ({
  connected: true,
  label: 'test',
  generate: async () => {
    if (fail) throw new Error('offline')
    return 'A real draft.'
  },
})

async function fresh() {
  const store = new Store(new Memory())
  await store.init()
  await store.clearSampleData()
  return store
}

describe('night shift', () => {
  it('drafts AI to-dos, skips her own, and leaves a brief', async () => {
    const store = await fresh()
    const a = store.create('tasks', { title: 'Outline the workbook', status: 'todo', mode: 'ai_does', importance: 3 })
    const mine = store.create('tasks', { title: 'Call the venue', status: 'todo', mode: 'me', importance: 5 })
    const r = await runNightShift(store, ai(), { max: 8 })

    expect(r.drafted.map((d) => d.title)).toEqual(['Outline the workbook'])
    expect(store.get('tasks', a.id)?.status).toBe('doing')
    expect(store.get('tasks', mine.id)?.status).toBe('todo')
    const action = store.all('actions').find((x) => x.taskId === a.id)
    expect(action?.output).toBe('A real draft.')
    expect(['draft', 'needs_approval']).toContain(action?.state)
    const brief = store.all('notifications').filter((n) => n.kind === 'night_shift' && !n.read)
    expect(brief).toHaveLength(1)
    expect(brief[0].body).toContain('Nothing was sent')
    // Already drafted: not picked up again the next night.
    expect(nightQueue(store)).toHaveLength(0)
  })

  it('respects the nightly limit', async () => {
    const store = await fresh()
    for (let i = 0; i < 3; i++) store.create('tasks', { title: `Task ${i}`, status: 'todo', mode: 'ai_helps', importance: 3 })
    const r = await runNightShift(store, ai(), { max: 2 })
    expect(r.drafted).toHaveLength(2)
    expect(r.leftForLater).toBe(1)
  })

  it('stops and undoes when the AI cannot be reached', async () => {
    const store = await fresh()
    const t = store.create('tasks', { title: 'Draft a post', status: 'todo', mode: 'ai_does', importance: 3 })
    const r = await runNightShift(store, ai(true), { max: 8 })
    expect(r.drafted).toHaveLength(0)
    expect(r.stopped).toMatch(/couldn’t be reached/)
    expect(store.get('tasks', t.id)?.status).toBe('todo')
    expect(store.all('actions').filter((x) => x.taskId === t.id)).toHaveLength(0)
  })
})
