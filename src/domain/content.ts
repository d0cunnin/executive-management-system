// Campaign and content rules: the approval state machine, who may approve,
// campaign objectives and metrics, filters, and missing-setup checks.
// Pure functions only, so they can be tested without a browser or database.
import type {
  Area, BrandSettings, Campaign, CampaignMetric, Channel, ContentItem, ContentRevision, ContentStatus, DB, PublishingRecord,
} from './types'

// ── Labels and options ──────────────────────────────────────────────────────

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  draft: 'Draft',
  needs_review: 'Needs review',
  changes_requested: 'Changes requested',
  approved: 'Approved — not scheduled',
  scheduled: 'Scheduled (recorded)',
  published: 'Published (recorded)',
  archived: 'Archived',
}

export const CONTENT_STATUS_TONE: Record<ContentStatus, string> = {
  draft: 'text-muted',
  needs_review: 'text-gold border-gold/40',
  changes_requested: 'text-rose-300 border-rose-400/40',
  approved: 'text-emerald-300 border-emerald-400/40',
  scheduled: 'text-sky-300 border-sky-400/40',
  published: 'text-violet-300 border-violet-400/40',
  archived: 'text-muted',
}

/** How each platform's content should be shaped. Used by people and assistants. */
export const PLATFORM_SHAPE: Partial<Record<Channel, string>> = {
  instagram: 'Hook in the first line · 3–5 short lines · carousel or Reel concept · CTA “link in bio” · 3–5 focused hashtags',
  facebook: 'Conversational opener · a short story or question · invite comments · direct link CTA',
  linkedin: 'Professional insight up top · 2–3 short paragraphs · leader/counselor angle · link in first comment',
  tiktok: '1-second visual hook · spoken script under 45s · on-screen text · CTA in caption',
  youtube: 'Searchable title · 8–12 min outline · chapters · CTA mid-roll and end screen',
  youtube_shorts: 'Hook in 2 seconds · one idea · vertical · CTA to the full video',
  email: 'Subject line + preview text · one story · one CTA button',
  substack: 'Headline · personal opening · 3 sections · subscribe/share CTA',
  pinterest: 'Keyword-rich title · vertical graphic · link to resource',
}

/** Platforms content can be planned for. */
export const CONTENT_PLATFORMS: Channel[] = ['facebook', 'instagram', 'tiktok', 'youtube', 'youtube_shorts', 'email', 'linkedin', 'substack', 'website']

export const OBJECTIVES = {
  leads: { label: 'Generate leads and inquiries', metrics: ['leads', 'inquiries', 'link_visits', 'clicks', 'conversions'] },
  engagement: { label: 'Increase community engagement', metrics: ['engagement', 'reach', 'impressions'] },
  event: { label: 'Promote an event', metrics: ['registrations', 'reach', 'clicks', 'link_visits'] },
  registrations: { label: 'Increase registrations', metrics: ['registrations', 'clicks', 'conversions', 'revenue'] },
  program: { label: 'Promote a service or program', metrics: ['inquiries', 'registrations', 'clicks', 'revenue'] },
  education: { label: 'Share educational content', metrics: ['reach', 'engagement', 'impressions'] },
  awareness: { label: 'Build awareness', metrics: ['reach', 'impressions', 'engagement'] },
  email_signups: { label: 'Drive email sign-ups', metrics: ['email_signups', 'clicks', 'link_visits'] },
} as const

export type ObjectiveKey = keyof typeof OBJECTIVES

export function objectiveLabel(objective: string): string {
  return OBJECTIVES[objective as ObjectiveKey]?.label ?? objective
}

export const METRICS: Record<string, { label: string; money?: boolean }> = {
  leads: { label: 'Leads' },
  inquiries: { label: 'Inquiries' },
  registrations: { label: 'Registrations' },
  email_signups: { label: 'Email sign-ups' },
  reach: { label: 'Reach' },
  impressions: { label: 'Impressions' },
  engagement: { label: 'Engagements' },
  clicks: { label: 'Clicks' },
  link_visits: { label: 'Link visits' },
  conversions: { label: 'Conversions' },
  revenue: { label: 'Revenue', money: true },
}

/** The metrics that matter for a campaign: its own choice, else its objective's. */
export function relevantMetrics(c: Campaign): string[] {
  if (c.successMetrics?.length) return c.successMetrics
  return [...(OBJECTIVES[c.objective as ObjectiveKey]?.metrics ?? ['reach', 'engagement', 'clicks'])]
}

/** Where a person goes to schedule or post. Opening a link schedules nothing. */
export function publishingDestination(channel?: Channel, brand?: BrandSettings): { label: string; url?: string } {
  const own = channel ? brand?.platformGuidance?.[channel]?.match(/https?:\/\/\S+/)?.[0] : undefined
  switch (channel) {
    case 'facebook':
    case 'instagram':
      return { label: 'Meta Business Suite', url: 'https://business.facebook.com/latest/content_calendar' }
    case 'tiktok':
      return { label: 'TikTok Studio', url: 'https://www.tiktok.com/tiktokstudio/upload' }
    case 'youtube':
    case 'youtube_shorts':
      return { label: 'YouTube Studio', url: 'https://studio.youtube.com' }
    case 'email':
      return { label: 'your email platform', url: own }
    default:
      return { label: 'the platform', url: own }
  }
}

// ── Roles ───────────────────────────────────────────────────────────────────

/** owner and approver may approve; editor may write and submit; viewer reads. */
export type Role = 'owner' | 'approver' | 'editor' | 'viewer'

export const canApprove = (role: Role | null | undefined) => role === 'owner' || role === 'approver'
export const canEdit = (role: Role | null | undefined) => role === 'owner' || role === 'approver' || role === 'editor'

// ── State machine ───────────────────────────────────────────────────────────

interface Rule {
  to: ContentStatus
  label: string
  /** Only owners and approvers. */
  approverOnly?: boolean
  needsReason?: boolean
}

const RULES: Record<ContentStatus, Rule[]> = {
  draft: [
    { to: 'needs_review', label: 'Submit for approval' },
    { to: 'archived', label: 'Archive' },
  ],
  needs_review: [
    { to: 'approved', label: 'Approve', approverOnly: true },
    { to: 'changes_requested', label: 'Request changes', approverOnly: true, needsReason: true },
    { to: 'draft', label: 'Return to draft' },
  ],
  changes_requested: [
    { to: 'draft', label: 'Return to draft' },
    { to: 'needs_review', label: 'Resubmit for approval' },
  ],
  approved: [
    { to: 'scheduled', label: 'Record external schedule' },
    { to: 'published', label: 'Record publication' },
    { to: 'draft', label: 'Return to draft' },
    { to: 'archived', label: 'Archive' },
  ],
  scheduled: [
    { to: 'published', label: 'Record publication' },
    { to: 'approved', label: 'Mark as not scheduled' },
    { to: 'archived', label: 'Archive' },
  ],
  published: [{ to: 'archived', label: 'Archive' }],
  archived: [{ to: 'draft', label: 'Restore as draft' }],
}

export function allowedTransitions(from: ContentStatus, role: Role | null | undefined): Rule[] {
  return (RULES[from] ?? []).filter((r) => !r.approverOnly || canApprove(role))
}

export interface TransitionInput {
  role: Role | null | undefined
  by: string
  reason?: string
  /** Required for scheduled and published: what actually happened outside EMS. */
  publishing?: PublishingRecord
  now?: string
}

export type TransitionResult =
  | { ok: true; patch: Partial<ContentItem>; event: { from: ContentStatus; to: ContentStatus; by: string; reason?: string } }
  | { ok: false; error: string }

/**
 * Move a draft between states. Approval never schedules or publishes;
 * scheduled and published require the external details to be recorded.
 */
export function transition(item: ContentItem, to: ContentStatus, input: TransitionInput): TransitionResult {
  const from = item.status
  const rule = (RULES[from] ?? []).find((r) => r.to === to)
  if (!rule) return { ok: false, error: `Can’t go from “${CONTENT_STATUS_LABEL[from]}” to “${CONTENT_STATUS_LABEL[to]}”.` }
  if (rule.approverOnly && !canApprove(input.role)) return { ok: false, error: 'Only an owner or approver can do this.' }
  if (!rule.approverOnly && !canEdit(input.role)) return { ok: false, error: 'You have view-only access.' }
  const reason = input.reason?.trim()
  if (rule.needsReason && !reason) return { ok: false, error: 'Please say briefly what should change.' }
  const now = input.now ?? new Date().toISOString()
  const patch: Partial<ContentItem> = { status: to, updatedBy: input.by }

  if (to === 'needs_review' && !item.title?.trim()) return { ok: false, error: 'Add a title before submitting.' }
  if (to === 'needs_review' && !item.body?.trim()) return { ok: false, error: 'Add the copy before submitting.' }
  if (to === 'approved') Object.assign(patch, { approvedBy: input.by, approvedAt: now, changesRequestedReason: undefined })
  if (to === 'changes_requested') patch.changesRequestedReason = reason
  if (to === 'draft' && from === 'approved') Object.assign(patch, { approvedBy: undefined, approvedAt: undefined })
  if (to === 'scheduled') {
    const p = input.publishing
    if (!p?.via?.trim() || !p.scheduledFor) return { ok: false, error: 'Record where it was scheduled and for when.' }
    patch.publishing = { ...item.publishing, via: p.via.trim(), scheduledFor: p.scheduledFor, externalRef: p.externalRef?.trim() || undefined, scheduledRecordedAt: now, scheduledRecordedBy: input.by }
  }
  if (to === 'published') {
    const p = input.publishing
    if (!p?.publishedAt) return { ok: false, error: 'Record when it was published.' }
    patch.publishing = { ...item.publishing, via: p.via?.trim() || item.publishing?.via, publishedAt: p.publishedAt, url: p.url?.trim() || undefined, publishedRecordedAt: now, publishedRecordedBy: input.by }
  }
  if (to === 'approved' && from === 'scheduled') {
    patch.publishing = { ...item.publishing, scheduledFor: undefined, externalRef: undefined, scheduledRecordedAt: undefined, scheduledRecordedBy: undefined }
  }
  return { ok: true, patch, event: { from, to, by: input.by, reason } }
}

// ── Editing ─────────────────────────────────────────────────────────────────

export const EDITABLE_FIELDS = ['title', 'body', 'cta', 'hashtags', 'publishDate', 'channel', 'campaignId', 'areaId', 'media', 'subject', 'previewText', 'audience', 'listRef', 'owner', 'kind'] as const
export type EditableField = (typeof EDITABLE_FIELDS)[number]
export type DraftEdit = Partial<Pick<ContentItem, EditableField>>

/** Fields whose change means the approved wording is no longer what was approved. */
const COPY_FIELDS: EditableField[] = ['title', 'body', 'cta', 'hashtags', 'media', 'subject', 'previewText', 'channel']

export function isCopyLocked(status: ContentStatus) {
  return status === 'scheduled' || status === 'published' || status === 'archived'
}

/**
 * Apply an edit: returns the patch and a revision of what it replaced.
 * Changing approved copy sends it back to draft so it is approved again.
 */
export function applyEdit(item: ContentItem, edit: DraftEdit, by: string):
  | { ok: true; patch: Partial<ContentItem>; revision: Omit<ContentRevision, 'id' | 'createdAt' | 'updatedAt'>; reapproval: boolean }
  | { ok: false; error: string } {
  const changed = (Object.keys(edit) as EditableField[]).filter((k) => JSON.stringify(edit[k] ?? null) !== JSON.stringify(item[k] ?? null))
  if (!changed.length) return { ok: false, error: 'Nothing changed.' }
  if (isCopyLocked(item.status) && changed.some((k) => COPY_FIELDS.includes(k))) {
    return { ok: false, error: 'This has been scheduled or published, so its copy is locked. Archive it or restore it as a draft first.' }
  }
  const reapproval = item.status === 'approved' && changed.some((k) => COPY_FIELDS.includes(k))
  const version = (item.version ?? 1) + 1
  const patch: Partial<ContentItem> = { ...edit, version, updatedBy: by }
  if (reapproval) Object.assign(patch, { status: 'draft' as ContentStatus, approvedBy: undefined, approvedAt: undefined })
  return {
    ok: true,
    patch,
    reapproval,
    revision: {
      contentId: item.id,
      version: item.version ?? 1,
      snapshot: {
        title: item.title, body: item.body, cta: item.cta, hashtags: item.hashtags, publishDate: item.publishDate, channel: item.channel,
        campaignId: item.campaignId, areaId: item.areaId, media: item.media, subject: item.subject, previewText: item.previewText, audience: item.audience,
      },
      changedBy: by,
      note: `Changed ${changed.join(', ')}`,
    },
  }
}

/** Older records used other status names. Map them without losing anything. */
export function normalizeContent(c: ContentItem): ContentItem {
  const s = c.status as string
  const status: ContentStatus = s === 'idea' ? 'draft' : s === 'needs_approval' ? 'needs_review' : (c.status ?? 'draft')
  return status === c.status ? c : { ...c, status }
}

// ── Filters and dashboards ──────────────────────────────────────────────────

export interface ContentFilter {
  areaId?: string
  campaignId?: string
  channel?: string
  status?: string
  owner?: string
  from?: string
  to?: string
}

export function filterContent(items: ContentItem[], f: ContentFilter, campaigns: Campaign[] = []): ContentItem[] {
  return items.filter((c) => {
    const area = c.areaId ?? campaigns.find((x) => x.id === c.campaignId)?.areaId
    if (f.areaId && area !== f.areaId) return false
    if (f.campaignId && c.campaignId !== f.campaignId) return false
    if (f.channel && c.channel !== f.channel) return false
    if (f.status && c.status !== f.status) return false
    if (f.owner && (c.owner ?? c.createdByAgent ?? '') !== f.owner) return false
    if ((f.from || f.to) && !c.publishDate) return false
    if (f.from && c.publishDate! < f.from) return false
    if (f.to && c.publishDate! > f.to) return false
    return true
  })
}

export interface CampaignFilter {
  areaId?: string
  channel?: string
  status?: string
  owner?: string
  from?: string
  to?: string
}

export function filterCampaigns(list: Campaign[], f: CampaignFilter): Campaign[] {
  return list.filter((c) => {
    if (f.areaId && c.areaId !== f.areaId) return false
    if (f.channel && !c.channels.includes(f.channel as Channel)) return false
    if (f.status && c.status !== f.status) return false
    if (f.owner && (c.owner ?? '') !== f.owner) return false
    // Date range: keep campaigns that overlap it.
    if (f.from && c.endDate && c.endDate < f.from) return false
    if (f.to && c.startDate && c.startDate > f.to) return false
    return true
  })
}

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number)
  const x = new Date(y, m - 1, d + n)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Content whose planned date has arrived but isn't through the needed step. */
export function overdueReason(c: ContentItem, today = todayKey()): string | null {
  if (!c.publishDate || c.status === 'published' || c.status === 'archived') return null
  if (c.status === 'scheduled') return c.publishDate < today && !c.publishing?.publishedAt ? 'Planned date passed — record whether it was published.' : null
  if (c.publishDate < today) return c.status === 'approved' ? 'Approved but never scheduled; planned date passed.' : 'Planned date passed before approval.'
  if (c.publishDate <= addDays(today, 2) && (c.status === 'draft' || c.status === 'needs_review' || c.status === 'changes_requested')) return 'Due within 2 days and not yet approved.'
  return null
}

/** Active campaign platforms that have no draft yet. */
export function missingDrafts(db: Pick<DB, 'campaigns' | 'content'>): { campaign: Campaign; channel: Channel }[] {
  const out: { campaign: Campaign; channel: Channel }[] = []
  for (const c of db.campaigns.filter((x) => x.status === 'active' || x.status === 'planning'))
    for (const ch of c.channels)
      if (!db.content.some((x) => x.campaignId === c.id && x.channel === ch && x.status !== 'archived')) out.push({ campaign: c, channel: ch })
  return out
}

// ── Setup checks ────────────────────────────────────────────────────────────

/**
 * What an initiative still needs configured. Some initiatives have a known
 * number of focus areas or pathways that only D'Andrea can name.
 */
export const REQUIRED_WORKSTREAMS: Record<string, { label: string; count?: number; suggestions?: string[] }> = {
  area_hub: { label: 'Focus areas', count: 5 },
  area_becoming: { label: 'Pathways', count: 2 },
  area_ark: {
    label: 'Workstreams',
    suggestions: ['Faith and spiritual growth', 'Mental health education and awareness', 'Holistic wellness', 'Community support', 'Programs and events', 'Partnerships and impact'],
  },
}

export function workstreamLabel(areaId: string) {
  return REQUIRED_WORKSTREAMS[areaId]?.label ?? 'Programs & workstreams'
}

export function missingBrandConfig(area: Area, brand: BrandSettings | undefined): string[] {
  const out: string[] = []
  if (!brand?.audience?.trim()) out.push('Audience')
  if (!brand?.tone?.trim()) out.push('Tone and voice')
  if (!brand?.mission?.trim() && !brand?.messaging?.trim()) out.push('Mission or core message')
  if (!brand?.approvedCtas?.length) out.push('Approved calls to action')
  const req = REQUIRED_WORKSTREAMS[area.id]
  if (req?.count && (brand?.workstreams?.length ?? 0) < req.count) out.push(`${req.label} (${brand?.workstreams?.length ?? 0} of ${req.count} named)`)
  return out
}

export function missingCampaignConfig(c: Campaign): string[] {
  const out: string[] = []
  if (!c.audience?.trim()) out.push('Target audience')
  if (!c.cta?.trim()) out.push('Primary call to action')
  if (!c.channels.length) out.push('Platforms')
  if (!c.startDate) out.push('Start date')
  return out
}

// ── Reporting ───────────────────────────────────────────────────────────────

export interface MetricSummary {
  metric: string
  actual: number | null
  target: number | null
  sources: string[]
}

/** Totals of entered actuals and the latest target, per relevant metric. Nothing is estimated. */
export function summarizeMetrics(campaign: Campaign, rows: CampaignMetric[]): MetricSummary[] {
  const mine = rows.filter((r) => r.campaignId === campaign.id)
  const keys = Array.from(new Set([...relevantMetrics(campaign), ...mine.map((r) => r.metric)]))
  return keys.map((metric) => {
    const actuals = mine.filter((r) => r.metric === metric && r.kind === 'actual')
    const targets = mine.filter((r) => r.metric === metric && r.kind === 'target').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return {
      metric,
      actual: actuals.length ? actuals.reduce((s, r) => s + r.value, 0) : null,
      target: targets[0]?.value ?? null,
      sources: Array.from(new Set(actuals.map((r) => r.source || 'Source not recorded'))),
    }
  })
}
