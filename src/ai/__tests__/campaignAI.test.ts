import { describe, expect, it } from 'vitest'
import type { Persistence } from '../../data/store'
import { Store } from '../../data/store'
import type { DB } from '../../domain/types'
import { campaignBrief, campaignContext, draftForCampaign, parseDraft, planCampaignTasks } from '../campaignAI'
import type { AIProvider, GenerateRequest } from '../provider'

const memory: Persistence = { kind: 'local', load: async () => null, saveCollection: async () => {}, saveAll: async (_db: DB) => {} }

async function freshStore() {
  const s = new Store(memory)
  await s.init()
  return s
}

class FakeAI implements AIProvider {
  readonly connected = true
  readonly label = 'fake'
  calls: GenerateRequest[] = []
  async generate(req: GenerateRequest) {
    this.calls.push(req)
    return 'TITLE: Spotlight\nCTA: Register now\nBODY:\nMeet our speakers.\nHASHTAGS: #faith #mentalhealth'
  }
}

describe('assistants work from shared campaign records', () => {
  it('sends the campaign, initiative and brand context with every draft request', async () => {
    const store = await freshStore()
    store.create('brandSettings', { areaId: 'area_summit', tone: 'Warm and direct', approvedCtas: ['Register now'], restrictions: 'No clinical claims' })
    const ai = new FakeAI()
    const { item } = await draftForCampaign(store, ai, 'c_summit', 'instagram', 'tester')
    const ctx = ai.calls[0].context
    expect(ctx).toContain('Campaign: Summit registration')
    expect(ctx).toContain('Objective: Increase registrations')
    expect(ctx).toContain('Initiative: Faith + Mental Health Summit')
    expect(ctx).toContain('Tone and voice: Warm and direct')
    expect(ctx).toContain('Content restrictions: No clinical claims')
    expect(ctx).toMatch(/never invent/i)
    expect(ai.calls[0].instruction).toContain('Instagram')
    expect(item).toMatchObject({ campaignId: 'c_summit', areaId: 'area_summit', channel: 'instagram', status: 'draft', engine: 'ai', createdByAgent: 'social', title: 'Spotlight', cta: 'Register now', hashtags: ['faith', 'mentalhealth'] })
  })

  it('never lets an assistant approve: drafts always start as drafts', async () => {
    const store = await freshStore()
    const { item } = await draftForCampaign(store, new FakeAI(), 'c_summit', 'email', 'tester')
    expect(item.status).toBe('draft')
    expect(item.createdByAgent).toBe('marketing')
  })

  it('marks missing information instead of inventing it when no AI is connected', async () => {
    const store = await freshStore()
    const offline: AIProvider = { connected: false, label: 'none', generate: async () => '' }
    const { item, note } = await draftForCampaign(store, offline, 'c_fmh_launch', 'youtube', 'tester')
    expect(item.engine).toBe('builtin')
    expect(note).toMatch(/Built-in template/)
    expect(item.body).toMatch(/\[.*needed.*\]|\[.*confirmation.*\]/i)
  })

  it('lists gaps in the context so the assistant asks', async () => {
    const store = await freshStore()
    const c = store.get('campaigns', 'c_fmh_launch')!
    expect(campaignContext(store.snapshot(), c)).toMatch(/MISSING — .*Target audience.*Primary call to action/)
  })

  it('parses structured replies and falls back to plain text', () => {
    expect(parseDraft('TITLE: A\nSUBJECT: S\nPREVIEW: P\nBODY:\nHello\nthere')).toMatchObject({ title: 'A', subject: 'S', previewText: 'P', body: 'Hello\nthere' })
    expect(parseDraft('Just some copy').body).toBe('Just some copy')
  })

  it('plans campaign work with dates and an honest scheduling step', async () => {
    const store = await freshStore()
    const tasks = planCampaignTasks(store.snapshot(), store.get('campaigns', 'c_summit')!)
    expect(tasks.some((t) => /Meta Business Suite.*record it/.test(t.title))).toBe(true)
    expect(tasks.every((t) => t.dueDate)).toBe(true)
  })

  it('summarizes campaigns for the Executive Assistant from records only', async () => {
    const store = await freshStore()
    const brief = campaignBrief(store.snapshot())
    expect(brief).toMatch(/1 draft waiting for your approval/)
    // Only active campaigns are reported on; the active Summit campaign has entered results.
    expect(brief).toMatch(/every active campaign has results entered/)
    store.update('campaigns', 'c_fmh_launch', { status: 'active' })
    expect(campaignBrief(store.snapshot())).toMatch(/no results entered yet for: FMH 101 course launch/)
  })
})
