import { describe, expect, it } from 'vitest'
import { buildSeed } from '../../data/seed'
import {
  allowedTransitions, applyEdit, canApprove, filterCampaigns, filterContent, missingBrandConfig, missingCampaignConfig, normalizeContent,
  overdueReason, summarizeMetrics, transition,
} from '../content'
import type { Campaign, ContentItem } from '../types'

const now = '2026-10-16T12:00:00.000Z'
const draft = (over: Partial<ContentItem> = {}): ContentItem => ({
  id: 'c1', createdAt: now, updatedAt: now, title: 'Post', body: 'Copy', kind: 'post', status: 'draft', channel: 'instagram', version: 1, ...over,
})

describe('approval state machine', () => {
  it('runs draft → needs review → approved → scheduled → published', () => {
    let item = draft()
    for (const [to, extra] of [
      ['needs_review', {}],
      ['approved', {}],
      ['scheduled', { publishing: { via: 'Meta Business Suite', scheduledFor: '2026-10-20' } }],
      ['published', { publishing: { publishedAt: '2026-10-20', url: 'https://facebook.com/p/1' } }],
    ] as const) {
      const r = transition(item, to, { role: 'owner', by: 'dandrea@example.com', now, ...extra })
      expect(r.ok, to).toBe(true)
      if (r.ok) item = { ...item, ...r.patch }
    }
    expect(item.status).toBe('published')
    expect(item.approvedBy).toBe('dandrea@example.com')
    expect(item.approvedAt).toBe(now)
    expect(item.publishing?.url).toBe('https://facebook.com/p/1')
  })

  it('approval never schedules or publishes', () => {
    const r = transition(draft({ status: 'needs_review' }), 'approved', { role: 'approver', by: 'a', now })
    expect(r.ok && r.patch.status).toBe('approved')
    expect(r.ok && r.patch.publishing).toBeUndefined()
  })

  it('requires the real external details to mark scheduled or published', () => {
    const approved = draft({ status: 'approved' })
    expect(transition(approved, 'scheduled', { role: 'owner', by: 'a' }).ok).toBe(false)
    expect(transition(approved, 'scheduled', { role: 'owner', by: 'a', publishing: { via: 'Meta' } }).ok).toBe(false)
    expect(transition(approved, 'published', { role: 'owner', by: 'a' }).ok).toBe(false)
  })

  it('lets an approver request changes, with a reason, and the writer resubmit', () => {
    const review = draft({ status: 'needs_review' })
    expect(transition(review, 'changes_requested', { role: 'owner', by: 'a' }).ok).toBe(false)
    const r = transition(review, 'changes_requested', { role: 'owner', by: 'a', reason: 'Shorter hook' })
    expect(r.ok && r.patch.changesRequestedReason).toBe('Shorter hook')
    const back = transition({ ...review, status: 'changes_requested' }, 'draft', { role: 'editor', by: 'e' })
    expect(back.ok).toBe(true)
  })

  it('does not let an editor or viewer approve', () => {
    const review = draft({ status: 'needs_review' })
    expect(transition(review, 'approved', { role: 'editor', by: 'e' }).ok).toBe(false)
    expect(transition(review, 'approved', { role: 'viewer', by: 'v' }).ok).toBe(false)
    expect(transition(review, 'approved', { role: null, by: 'x' }).ok).toBe(false)
    expect(canApprove('editor')).toBe(false)
    expect(allowedTransitions('needs_review', 'editor').map((r) => r.to)).toEqual(['draft'])
  })

  it('refuses jumps the workflow does not allow', () => {
    expect(transition(draft(), 'published', { role: 'owner', by: 'a', publishing: { publishedAt: '2026-10-01' } }).ok).toBe(false)
    expect(transition(draft(), 'approved', { role: 'owner', by: 'a' }).ok).toBe(false)
  })

  it('will not submit an empty draft', () => {
    expect(transition(draft({ body: '' }), 'needs_review', { role: 'owner', by: 'a' }).ok).toBe(false)
  })
})

describe('editing', () => {
  it('keeps the previous version and bumps the version number', () => {
    const r = applyEdit(draft({ body: 'Old' }), { body: 'New' }, 'a')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.revision.snapshot.body).toBe('Old')
      expect(r.patch.version).toBe(2)
    }
  })
  it('sends approved copy back for re-approval when the wording changes', () => {
    const r = applyEdit(draft({ status: 'approved', approvedBy: 'a' }), { body: 'Changed' }, 'b')
    expect(r.ok && r.reapproval).toBe(true)
    expect(r.ok && r.patch.status).toBe('draft')
  })
  it('allows moving an approved planned date without re-approval', () => {
    const r = applyEdit(draft({ status: 'approved' }), { publishDate: '2026-11-01' }, 'b')
    expect(r.ok && r.reapproval).toBe(false)
  })
  it('locks published copy', () => {
    expect(applyEdit(draft({ status: 'published' }), { body: 'x' }, 'b').ok).toBe(false)
  })
})

describe('older records', () => {
  it('maps old status names without changing anything else', () => {
    const old = { ...draft(), status: 'needs_approval' } as unknown as ContentItem
    expect(normalizeContent(old)).toEqual({ ...old, status: 'needs_review' })
    expect(normalizeContent({ ...draft(), status: 'idea' } as unknown as ContentItem).status).toBe('draft')
  })
})

describe('filters', () => {
  const db = buildSeed()
  it('filters campaigns by initiative and platform', () => {
    expect(filterCampaigns(db.campaigns, { areaId: 'area_summit' }).map((c) => c.id)).toEqual(['c_summit'])
    expect(filterCampaigns(db.campaigns, { channel: 'youtube' }).map((c) => c.id)).toEqual(['c_fmh_launch'])
    expect(filterCampaigns(db.campaigns, { areaId: 'area_summit', channel: 'youtube' })).toHaveLength(0)
  })
  it('filters calendar content by initiative, platform, status and dates', () => {
    const items = [
      draft({ id: 'a', areaId: 'area_ark', channel: 'facebook', publishDate: '2026-10-10' }),
      draft({ id: 'b', areaId: 'area_summit', channel: 'instagram', publishDate: '2026-10-20', status: 'approved' }),
      draft({ id: 'c', campaignId: 'c_summit', channel: 'tiktok', publishDate: '2026-11-02' }),
    ]
    expect(filterContent(items, { areaId: 'area_summit' }, db.campaigns).map((c) => c.id)).toEqual(['b', 'c'])
    expect(filterContent(items, { channel: 'facebook' }).map((c) => c.id)).toEqual(['a'])
    expect(filterContent(items, { status: 'approved' }).map((c) => c.id)).toEqual(['b'])
    expect(filterContent(items, { from: '2026-10-15', to: '2026-10-31' }).map((c) => c.id)).toEqual(['b'])
  })
})

describe('setup checks and reporting', () => {
  const db = buildSeed()
  it('flags missing brand settings and unnamed focus areas and pathways', () => {
    const hub = db.areas.find((a) => a.id === 'area_hub')!
    expect(missingBrandConfig(hub, undefined)).toContain('Focus areas (0 of 5 named)')
    const bh = db.areas.find((a) => a.id === 'area_becoming')!
    expect(missingBrandConfig(bh, undefined)).toContain('Pathways (0 of 2 named)')
  })
  it('flags what a campaign still needs', () => {
    const c: Campaign = { id: 'x', createdAt: now, updatedAt: now, name: 'X', areaId: 'area_hub', objective: 'leads', channels: [], status: 'planning' }
    expect(missingCampaignConfig(c)).toEqual(['Target audience', 'Primary call to action', 'Platforms', 'Start date'])
  })
  it('reports only entered numbers, separating actuals from targets', () => {
    const c = db.campaigns.find((x) => x.id === 'c_summit')!
    const s = summarizeMetrics(c, db.campaignMetrics)
    const reg = s.find((m) => m.metric === 'registrations')!
    expect(reg.actual).toBe(112)
    expect(reg.target).toBe(300)
    const empty = summarizeMetrics({ ...c, id: 'none' }, db.campaignMetrics)
    expect(empty.every((m) => m.actual === null && m.target === null)).toBe(true)
  })
  it('names overdue approvals', () => {
    expect(overdueReason(draft({ status: 'needs_review', publishDate: '2026-10-17' }), '2026-10-16')).toMatch(/not yet approved/)
    expect(overdueReason(draft({ status: 'approved', publishDate: '2026-10-10' }), '2026-10-16')).toMatch(/never scheduled/)
    expect(overdueReason(draft({ status: 'published', publishDate: '2026-10-10' }), '2026-10-16')).toBeNull()
  })
})
