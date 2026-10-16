// Campaign and content operations on the store. Every change goes through
// the rules in domain/content.ts and leaves a record: revisions for edits,
// events for status changes. Edits and status changes wait for the database
// to confirm before reporting success.
import { applyEdit, transition, type DraftEdit, type TransitionInput } from '../domain/content'
import type { BaseRecord, Campaign, CampaignMetric, ContentItem, ContentStatus } from '../domain/types'
import type { Store } from './store'

export type NewContent = Omit<ContentItem, keyof BaseRecord | 'status' | 'version'> & { status?: ContentStatus }

export type Outcome = { ok: true; message?: string } | { ok: false; error: string }

const failed = (e: unknown): Outcome => ({ ok: false, error: `Not saved: ${e instanceof Error ? e.message : String(e)}` })

export function createDraft(store: Store, data: NewContent, by: string): ContentItem {
  const campaign = data.campaignId ? store.get('campaigns', data.campaignId) : undefined
  return store.create('content', {
    ...data,
    areaId: data.areaId ?? campaign?.areaId,
    audience: data.audience ?? campaign?.audience,
    cta: data.cta ?? campaign?.cta,
    status: data.status ?? 'draft',
    version: 1,
    updatedBy: by,
  })
}

/** Create a draft and wait until it is saved. */
export async function createDraftConfirmed(store: Store, data: NewContent, by: string): Promise<{ ok: true; item: ContentItem } | { ok: false; error: string }> {
  const campaign = data.campaignId ? store.get('campaigns', data.campaignId) : undefined
  try {
    const item = await store.createConfirmed('content', {
      ...data,
      areaId: data.areaId ?? campaign?.areaId,
      status: data.status ?? 'draft',
      version: 1,
      updatedBy: by,
    })
    return { ok: true, item }
  } catch (e) {
    return failed(e) as { ok: false; error: string }
  }
}

/** Save edits without changing approval, keeping the previous version. */
export async function saveDraft(store: Store, id: string, edit: DraftEdit, by: string): Promise<Outcome> {
  const item = store.get('content', id)
  if (!item) return { ok: false, error: 'That draft no longer exists.' }
  const r = applyEdit(item, edit, by)
  if (!r.ok) return r
  try {
    await store.updateConfirmed('content', id, r.patch)
  } catch (e) {
    return failed(e)
  }
  // History is best-effort: a missing history table must not lose the edit.
  store.create('contentRevisions', r.revision)
  if (r.reapproval) {
    store.create('contentEvents', { contentId: id, from: 'approved', to: 'draft', by, reason: 'Copy changed after approval — needs approval again.' })
    return { ok: true, message: 'Saved. Because the approved copy changed, it’s back to draft and needs approval again.' }
  }
  return { ok: true, message: 'Saved.' }
}

/** Change status through the state machine and record who, when and why. */
export async function moveContent(store: Store, id: string, to: ContentStatus, input: TransitionInput): Promise<Outcome> {
  const item = store.get('content', id)
  if (!item) return { ok: false, error: 'That draft no longer exists.' }
  const r = transition(item, to, input)
  if (!r.ok) return r
  try {
    await store.updateConfirmed('content', id, r.patch)
  } catch (e) {
    return failed(e)
  }
  store.create('contentEvents', { contentId: id, ...r.event })
  if (to === 'published') store.logProgress({ kind: 'published', title: `Published: ${item.title}`, areaId: item.areaId })
  return { ok: true }
}

export function createCampaign(store: Store, data: Omit<Campaign, keyof BaseRecord>): Campaign {
  const c = store.create('campaigns', data)
  if (data.status === 'active') store.logProgress({ kind: 'campaign_launched', title: `Campaign started: ${c.name}`, areaId: c.areaId })
  return c
}

export function recordMetric(store: Store, data: Omit<CampaignMetric, keyof BaseRecord>): CampaignMetric | { error: string } {
  if (!Number.isFinite(data.value)) return { error: 'Enter a number.' }
  if (data.kind === 'actual' && !data.source?.trim()) return { error: 'Say where this number came from (for example, Meta Business Suite insights).' }
  return store.create('campaignMetrics', data)
}
