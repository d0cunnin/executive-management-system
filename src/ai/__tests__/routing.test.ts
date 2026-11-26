import { describe, expect, it } from 'vitest'
import { Store, type Persistence } from '../../data/store'
import type { BaseRecord, CollectionName, DB, Task } from '../../domain/types'
import type { AIProvider, GenerateRequest } from '../provider'
import { chooseRoute, parseRoute, runTask } from '../routing'

const task = (title: string, notes?: string) => ({ id: 't1', title, notes, status: 'todo', mode: 'ai_does', importance: 3, createdAt: '', updatedAt: '' }) as Task
const reply = (text: string, seen: GenerateRequest[] = []): AIProvider => ({ connected: true, label: 'test', generate: async (r) => (seen.push(r), text) })
const db = { areas: [], projects: [] } as unknown as DB

describe('choosing the assistant', () => {
  it('uses the AI’s pick and gives it her notes', async () => {
    const seen: GenerateRequest[] = []
    const r = await chooseRoute(reply('research_brief', seen), db, task('Venue for June', 'Find 3 venues near Atlanta under $2k'))
    expect(r).toMatchObject({ skill: 'research_brief', agentKey: 'research', chosenBy: 'ai' })
    expect(seen[0].context).toContain('Find 3 venues near Atlanta')
  })

  it('falls back to keywords when the AI answers off the list or fails', async () => {
    expect(await chooseRoute(reply('send it now'), db, task('Draft newsletter'))).toMatchObject({ skill: 'draft_email', chosenBy: 'keywords' })
    const broken: AIProvider = { connected: true, label: 'x', generate: async () => { throw new Error('down') } }
    expect(await chooseRoute(broken, db, task('Instagram post'))).toMatchObject({ skill: 'social_posts', chosenBy: 'keywords' })
  })

  it('never makes public work skip approval', async () => {
    // Keywords say it goes public; the AI's pick doesn't. It still waits for approval.
    expect((await chooseRoute(reply('draft_outline'), db, task('Instagram post about the summit'))).consequential).toBe(true)
  })

  it('reads the key out of a chatty reply', () => {
    expect(parseRoute('I would pick grant_prep.')?.agentKey).toBe('nonprofit')
    expect(parseRoute('nothing here')).toBeUndefined()
  })
})

describe('Do it', () => {
  it('passes her notes into the draft request', async () => {
    const mem: Persistence = { kind: 'local', load: async () => null, saveCollection: async (_n: CollectionName, _r: BaseRecord[], _c: string[], _x: string[]) => {}, saveAll: async () => {} }
    const store = new Store(mem)
    await store.init()
    const t = store.create('tasks', { title: 'Write a welcome note', notes: 'Warm, 150 words, for new volunteers', status: 'todo', mode: 'ai_does', importance: 3 })
    const seen: GenerateRequest[] = []
    const action = await runTask(store, reply('draft_outline', seen), t)
    expect(seen[1].context).toContain('Warm, 150 words, for new volunteers')
    expect(action.engine).toBe('ai')
  })
})
