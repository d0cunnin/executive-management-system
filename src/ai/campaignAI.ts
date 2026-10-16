// Assistants working from shared campaign and initiative records.
// Drafts are created as content records (status "draft"), never approved,
// scheduled or sent by an assistant.
import { createDraft } from '../data/contentOps'
import type { Store } from '../data/store'
import { PLATFORM_SHAPE, missingBrandConfig, missingCampaignConfig, objectiveLabel, overdueReason, workstreamLabel } from '../domain/content'
import { CHANNEL_LABEL } from '../domain/labels'
import type { Campaign, Channel, ContentItem, DB } from '../domain/types'
import { dayOffset, friendlyDate } from '../lib/util'
import type { AIProvider } from './provider'

/**
 * Everything an assistant may rely on for this campaign, from EMS records
 * only. Gaps are listed as gaps so the assistant asks instead of inventing.
 */
export function campaignContext(db: DB, c: Campaign, channel?: Channel): string {
  const area = db.areas.find((a) => a.id === c.areaId)
  const brand = db.brandSettings.find((b) => b.areaId === c.areaId)
  const gaps = [...missingCampaignConfig(c), ...(area ? missingBrandConfig(area, brand) : ['Initiative'])]
  const existing = db.content.filter((x) => x.campaignId === c.id && x.status !== 'archived')
  return [
    `Initiative: ${area?.name ?? 'unknown'}${brand?.description ? ` — ${brand.description}` : ''}`,
    brand?.mission && `Mission: ${brand.mission}`,
    brand?.messaging && `Core messaging: ${brand.messaging}`,
    brand?.tone && `Tone and voice: ${brand.tone}`,
    brand?.audience && `Initiative audience: ${brand.audience}`,
    brand?.workstreams?.length && `${workstreamLabel(c.areaId)}: ${brand.workstreams.map((w) => w.name).join('; ')}`,
    brand?.approvedCtas?.length && `Approved calls to action: ${brand.approvedCtas.join('; ')}`,
    brand?.approvedLinks?.length && `Approved links: ${brand.approvedLinks.join(' ')}`,
    brand?.restrictions && `Content restrictions: ${brand.restrictions}`,
    channel && brand?.platformGuidance?.[channel] && `${CHANNEL_LABEL[channel]} guidance: ${brand.platformGuidance[channel]}`,
    `Campaign: ${c.name}`,
    `Objective: ${objectiveLabel(c.objective)}`,
    c.description && `Description: ${c.description}`,
    `Campaign audience: ${c.audience || 'NOT SET'}`,
    c.message && `Key message: ${c.message}`,
    c.offer && `Offer: ${c.offer}`,
    `Primary call to action: ${c.cta || 'NOT SET'}`,
    `Dates: ${c.startDate ?? '?'} to ${c.endDate ?? '?'}`,
    existing.length && `Already drafted for this campaign (don't repeat): ${existing.map((x) => `${x.title}${x.channel ? ` (${CHANNEL_LABEL[x.channel]})` : ''}`).join('; ')}`,
    gaps.length && `MISSING — ask for these or mark the draft [Needs confirmation]; never invent them: ${gaps.join(', ')}`,
    'Never invent facts, testimonials, quotations, program details, credentials, partnerships or performance numbers.',
  ]
    .filter(Boolean)
    .join('\n')
}

const AGENT_FOR: Partial<Record<Channel, string>> = { email: 'marketing', substack: 'writing', website: 'writing' }

/** Parse "TITLE: … / SUBJECT: … / PREVIEW: … / BODY: … / HASHTAGS: …" output. Falls back to the whole text as the body. */
export function parseDraft(text: string): Partial<ContentItem> {
  const grab = (label: string) => text.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'))?.[1]?.trim()
  const body = text.match(/^BODY:\s*\n?([\s\S]*?)(?=^\s*(HASHTAGS|CTA):|$(?![\s\S]))/im)?.[1]?.trim()
  const tags = grab('HASHTAGS')
  return {
    title: grab('TITLE'),
    subject: grab('SUBJECT'),
    previewText: grab('PREVIEW'),
    cta: grab('CTA'),
    body: body || text.trim(),
    hashtags: tags ? tags.split(/[\s,]+/).filter((t) => t.startsWith('#')).map((t) => t.replace(/^#+/, '')) : undefined,
  }
}

function template(db: DB, c: Campaign, channel: Channel): Partial<ContentItem> {
  const brand = db.brandSettings.find((b) => b.areaId === c.areaId)
  const shape = PLATFORM_SHAPE[channel] ?? 'Adapt length, structure and call to action to the platform.'
  const cta = c.cta || brand?.approvedCtas?.[0]
  const lines =
    channel === 'email'
      ? ['Opening: [a short story or moment your reader recognizes — needs your words]', `Point: [what ${c.audience || 'your audience'} should know — needs confirmation]`, c.offer ? `Offer: ${c.offer}` : 'Offer: [needs confirmation]', `Button: ${cta || '[call to action needed]'}`]
      : [`Hook: [one line that stops ${c.audience || 'your audience'} scrolling — needs your words]`, `Message: ${c.message || '[key message needed]'}`, `Call to action: ${cta || '[call to action needed]'}`]
  return {
    title: `${c.name} — ${CHANNEL_LABEL[channel]}`,
    subject: channel === 'email' ? `[Subject line for ${c.name}]` : undefined,
    previewText: channel === 'email' ? '[Preview text]' : undefined,
    body: [...lines, '', `How ${CHANNEL_LABEL[channel]} posts are shaped: ${shape}`, '', 'Built-in template — no AI model was used. Replace the bracketed parts.'].join('\n'),
    cta,
  }
}

/** Create one platform-specific draft for a campaign. */
export async function draftForCampaign(store: Store, ai: AIProvider, campaignId: string, channel: Channel, by: string): Promise<{ item: ContentItem; note: string }> {
  const db = store.snapshot()
  const c = db.campaigns.find((x) => x.id === campaignId)
  if (!c) throw new Error('Campaign not found.')
  const agentKey = AGENT_FOR[channel] ?? 'social'
  let parsed: Partial<ContentItem>
  let engine: ContentItem['engine'] = 'builtin'
  let note = 'Built-in template (no AI model connected). Fill in the bracketed parts.'
  if (ai.connected) {
    try {
      const instruction =
        channel === 'email'
          ? 'Write one marketing email for this campaign. Reply exactly in this format:\nTITLE: <internal title>\nSUBJECT: <subject line>\nPREVIEW: <preview text>\nCTA: <call to action>\nBODY:\n<email body>'
          : `Write one ${CHANNEL_LABEL[channel]} post for this campaign, shaped for ${CHANNEL_LABEL[channel]} (${PLATFORM_SHAPE[channel] ?? 'platform norms'}). Do not reuse wording written for other platforms. Reply exactly in this format:\nTITLE: <internal title>\nCTA: <call to action>\nBODY:\n<post copy, or for video a script with on-screen text>\nHASHTAGS: <#tags, or none>`
      parsed = parseDraft(await ai.generate({ agentKey, instruction, context: campaignContext(db, c, channel) }))
      engine = 'ai'
      note = 'Drafted by your connected AI. Check every fact before submitting.'
    } catch (e) {
      parsed = template(db, c, channel)
      note = `AI unavailable (${e instanceof Error ? e.message : 'error'}). Built-in template instead.`
    }
  } else {
    parsed = template(db, c, channel)
  }
  const item = createDraft(
    store,
    {
      title: parsed.title || `${c.name} — ${CHANNEL_LABEL[channel]}`,
      body: parsed.body,
      subject: parsed.subject,
      previewText: parsed.previewText,
      cta: parsed.cta || c.cta,
      hashtags: parsed.hashtags,
      channel,
      kind: channel === 'email' ? 'email' : channel === 'youtube' ? 'video' : channel === 'tiktok' || channel === 'youtube_shorts' ? 'short' : 'post',
      campaignId: c.id,
      areaId: c.areaId,
      audience: c.audience,
      owner: agentKey,
      createdByAgent: agentKey,
      engine,
    },
    by,
  )
  return { item, note }
}

export interface ProposedTask {
  title: string
  dueDate?: string
  milestone?: boolean
}

/** Project Assistant: turn a campaign into concrete steps with dates. */
export function planCampaignTasks(db: DB, c: Campaign): ProposedTask[] {
  const start = c.startDate ?? dayOffset(0)
  const end = c.endDate
  const plus = (iso: string, n: number) => {
    const [y, m, d] = iso.split('-').map(Number)
    const x = new Date(y, m - 1, d + n)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  }
  const out: ProposedTask[] = []
  const gaps = missingCampaignConfig(c)
  if (gaps.length) out.push({ title: `Confirm campaign details: ${gaps.join(', ')}`, dueDate: plus(start, -3) })
  out.push({ title: `Approve the core message and call to action for ${c.name}`, dueDate: plus(start, -2), milestone: true })
  for (const ch of c.channels) {
    if (!db.content.some((x) => x.campaignId === c.id && x.channel === ch)) out.push({ title: `Draft ${CHANNEL_LABEL[ch]} content for ${c.name}`, dueDate: plus(start, -1) })
  }
  out.push({ title: `Review and approve ${c.name} drafts`, dueDate: start, milestone: true })
  if (c.channels.some((ch) => ch === 'facebook' || ch === 'instagram')) out.push({ title: 'Schedule approved Facebook/Instagram posts in Meta Business Suite, then record it in EMS', dueDate: start })
  if (c.channels.includes('email')) out.push({ title: 'Load the approved email into the email platform and record when it is sent', dueDate: start })
  if (['leads', 'program', 'registrations', 'event'].includes(c.objective)) out.push({ title: `Follow up on inquiries from ${c.name}`, dueDate: plus(start, 7) })
  out.push({ title: `Enter mid-campaign results for ${c.name}`, dueDate: plus(start, 14) })
  if (end) out.push({ title: `Enter final results and decide what comes next for ${c.name}`, dueDate: plus(end, 2), milestone: true })
  return out
}

/** Executive Assistant: what needs attention across campaigns. */
export function campaignBrief(db: DB): string {
  const review = db.content.filter((c) => c.status === 'needs_review')
  const changes = db.content.filter((c) => c.status === 'changes_requested')
  const approved = db.content.filter((c) => c.status === 'approved')
  const overdue = db.content.map((c) => ({ c, why: overdueReason(c) })).filter((x) => x.why)
  const active = db.campaigns.filter((c) => c.status === 'active')
  const ending = active.filter((c) => c.endDate && c.endDate >= dayOffset(0) && c.endDate <= dayOffset(14))
  const noResults = active.filter((c) => !db.campaignMetrics.some((m) => m.campaignId === c.id && m.kind === 'actual'))
  const byArea = new Map<string, number>()
  for (const c of [...review, ...overdue.map((x) => x.c)]) if (c.areaId) byArea.set(c.areaId, (byArea.get(c.areaId) ?? 0) + 1)
  const area = (id?: string) => db.areas.find((a) => a.id === id)?.name ?? 'No initiative'
  return [
    'CAMPAIGNS — WHAT NEEDS YOU',
    `• ${review.length} draft${review.length === 1 ? '' : 's'} waiting for your approval${review.length ? `: ${review.slice(0, 4).map((c) => c.title).join('; ')}` : ''}`,
    changes.length ? `• ${changes.length} sent back for changes` : null,
    `• ${approved.length} approved but not yet scheduled on a platform`,
    '',
    'OVERDUE',
    ...(overdue.length ? overdue.slice(0, 6).map(({ c, why }) => `• ${c.title} (${area(c.areaId)}) — ${why}`) : ['• Nothing overdue.']),
    '',
    'DEADLINES',
    ...(ending.length ? ending.map((c) => `• ${c.name} ends ${friendlyDate(c.endDate!)}`) : ['• No campaigns ending in the next two weeks.']),
    '',
    'BY INITIATIVE',
    ...(byArea.size ? [...byArea].sort((a, b) => b[1] - a[1]).map(([id, n]) => `• ${area(id)}: ${n} item${n === 1 ? '' : 's'} need attention`) : ['• Every initiative is clear.']),
    '',
    noResults.length ? `RESULTS — no results entered yet for: ${noResults.map((c) => c.name).join(', ')}. Performance changes can’t be reported until results are entered.` : 'RESULTS — every active campaign has results entered.',
  ]
    .filter((l) => l !== null)
    .join('\n')
}
