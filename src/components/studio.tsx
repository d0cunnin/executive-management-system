import { AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDB, useEMS } from '../app/EMSContext'
import { useAuth } from '../auth/AuthContext'
import {
  CONTENT_PLATFORMS, CONTENT_STATUS_LABEL, CONTENT_STATUS_TONE, OBJECTIVES, canApprove, canEdit, missingCampaignConfig,
  type ContentFilter, type Role,
} from '../domain/content'
import { CHANNEL_LABEL } from '../domain/labels'
import type { Campaign, CampaignStatus, Channel, ContentStatus } from '../domain/types'
import { useSearchState } from '../lib/urlState'
import { cn } from '../lib/util'
import { Field, Modal } from './ui'

/** Who is acting, and what they may do. Used for history and approvals. */
export function useActor(): { name: string; role: Role | null; canApprove: boolean; canEdit: boolean; roleError: string | null } {
  const { user, role, mode, roleError } = useAuth()
  const name = user?.email ?? (mode === 'demo' ? 'You (demo mode)' : 'Signed-in user')
  return { name, role, canApprove: canApprove(role), canEdit: canEdit(role), roleError }
}

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <span className={cn('chip', CONTENT_STATUS_TONE[status])}>{CONTENT_STATUS_LABEL[status]}</span>
}

/** Says plainly when the Studio's database setup or roles are missing. */
export function StudioSetupNotice() {
  const { store } = useEMS()
  const { roleError } = useActor()
  const missing = store.setupMissing
  if (!missing.length && !roleError) return null
  return (
    <div className="mb-5 flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-100" role="status">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">Content Studio setup isn’t finished.</p>
        {missing.length > 0 && <p className="mt-0.5 text-amber-100/80">Revision history, approval records, metrics and brand settings can’t be saved until the Content Studio migration runs in Supabase ({missing.length} table{missing.length === 1 ? '' : 's'} missing). Drafts and campaigns still save.</p>}
        {roleError && <p className="mt-0.5 text-amber-100/80">{roleError} Until then, approving is turned off.</p>}
      </div>
    </div>
  )
}

const FILTER_KEYS = ['area', 'campaign', 'channel', 'status', 'owner', 'from', 'to'] as const

/** Filters kept in the page address, so they survive refreshes and links. */
export function useContentFilters(): [ContentFilter, (k: (typeof FILTER_KEYS)[number], v: string) => void, () => void] {
  const [params, update] = useSearchState()
  const f: ContentFilter = {
    areaId: params.get('area') || undefined,
    campaignId: params.get('campaign') || undefined,
    channel: params.get('channel') || undefined,
    status: params.get('status') || undefined,
    owner: params.get('owner') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  }
  const set = (k: (typeof FILTER_KEYS)[number], v: string) =>
    update((next) => {
      if (v) next.set(k, v)
      else next.delete(k)
      if (k === 'area') next.delete('campaign')
    })
  const clear = () => update((next) => FILTER_KEYS.forEach((k) => next.delete(k)))
  return [f, set, clear]
}

export function FilterBar({ show = ['area', 'campaign', 'channel', 'status', 'owner', 'dates'] }: { show?: ('area' | 'campaign' | 'channel' | 'status' | 'owner' | 'dates' | 'campaignStatus')[] }) {
  const db = useDB()
  const [f, set, clear] = useContentFilters()
  const owners = useMemo(
    () => Array.from(new Set([...db.content.map((c) => c.owner ?? c.createdByAgent), ...db.campaigns.map((c) => c.owner)].filter(Boolean) as string[])).sort(),
    [db],
  )
  const active = Object.values(f).some(Boolean)
  const sel = 'input w-auto min-w-0 py-1.5 text-xs'
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2" role="search" aria-label="Filters">
      {show.includes('area') && (
        <select className={sel} value={f.areaId ?? ''} onChange={(e) => set('area', e.target.value)} aria-label="Initiative">
          <option value="">All initiatives</option>
          {db.areas.filter((a) => a.kind !== 'system').map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
      {show.includes('campaign') && (
        <select className={sel} value={f.campaignId ?? ''} onChange={(e) => set('campaign', e.target.value)} aria-label="Campaign">
          <option value="">All campaigns</option>
          {db.campaigns.filter((c) => !f.areaId || c.areaId === f.areaId).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {show.includes('channel') && (
        <select className={sel} value={f.channel ?? ''} onChange={(e) => set('channel', e.target.value)} aria-label="Platform">
          <option value="">All platforms</option>
          {CONTENT_PLATFORMS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABEL[c]}
            </option>
          ))}
        </select>
      )}
      {show.includes('status') && (
        <select className={sel} value={f.status ?? ''} onChange={(e) => set('status', e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          {(Object.keys(CONTENT_STATUS_LABEL) as ContentStatus[]).map((s) => (
            <option key={s} value={s}>
              {CONTENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      )}
      {show.includes('campaignStatus') && (
        <select className={sel} value={f.status ?? ''} onChange={(e) => set('status', e.target.value)} aria-label="Campaign status">
          <option value="">Any campaign status</option>
          {CAMPAIGN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CAMPAIGN_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      )}
      {show.includes('owner') && owners.length > 0 && (
        <select className={sel} value={f.owner ?? ''} onChange={(e) => set('owner', e.target.value)} aria-label="Responsible person">
          <option value="">Anyone responsible</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {AGENT_NAMES[o] ?? o}
            </option>
          ))}
        </select>
      )}
      {show.includes('dates') && (
        <span className="flex items-center gap-1 text-xs text-muted">
          <input type="date" className={sel} value={f.from ?? ''} onChange={(e) => set('from', e.target.value)} aria-label="From date" />
          to
          <input type="date" className={sel} value={f.to ?? ''} onChange={(e) => set('to', e.target.value)} aria-label="To date" />
        </span>
      )}
      {active && (
        <button className="text-xs text-muted underline-offset-4 hover:text-white hover:underline" onClick={clear}>
          Clear filters
        </button>
      )}
    </div>
  )
}

/** Assistant keys used as owners on AI drafts, shown by name. */
export const AGENT_NAMES: Record<string, string> = {
  social: 'Social Media Assistant',
  marketing: 'Marketing Assistant',
  executive: 'Executive Assistant',
  project: 'Project Assistant',
  writing: 'Writing Assistant',
}

export const CAMPAIGN_STATUSES: CampaignStatus[] = ['planning', 'active', 'paused', 'completed', 'archived']
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
}

export function SetupList({ items, what }: { items: string[]; what: string }) {
  if (!items.length) return null
  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2.5 text-xs text-amber-100" role="status">
      <p className="font-medium">{what} still needs:</p>
      <p className="mt-0.5 text-amber-100/80">{items.join(' · ')}</p>
    </div>
  )
}

type CampaignDraft = Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>

export const emptyCampaign = (areaId = ''): CampaignDraft => ({
  name: '', areaId, objective: 'leads', audience: '', description: '', channels: [], cta: '', owner: '', status: 'planning', successMetrics: undefined,
})

/** Create or edit a campaign. Calls onSave with the full record. */
export function CampaignForm({ open, initial, onClose, onSave, title }: { open: boolean; initial: CampaignDraft; onClose: () => void; onSave: (c: CampaignDraft) => void; title: string }) {
  const db = useDB()
  const [c, setC] = useState<CampaignDraft>(initial)
  const [error, setError] = useState<string | null>(null)
  const [opened, setOpened] = useState(false)
  if (open && !opened) {
    setOpened(true)
    setC(initial)
    setError(null)
  }
  if (!open && opened) setOpened(false)
  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => setC((x) => ({ ...x, [k]: v }))
  const toggle = (ch: Channel) => set('channels', c.channels.includes(ch) ? c.channels.filter((x) => x !== ch) : [...c.channels, ch])
  const metrics = c.successMetrics ?? [...(OBJECTIVES[c.objective as keyof typeof OBJECTIVES]?.metrics ?? [])]
  const toggleMetric = (m: string) => set('successMetrics', metrics.includes(m) ? metrics.filter((x) => x !== m) : [...metrics, m])

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!c.name.trim()) return setError('Give the campaign a name.')
          if (!c.areaId) return setError('Choose the initiative this campaign serves.')
          if (c.startDate && c.endDate && c.endDate < c.startDate) return setError('The end date is before the start date.')
          onSave({ ...c, name: c.name.trim(), successMetrics: metrics })
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Campaign name">
            <input autoFocus className="input" value={c.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Initiative">
            <select className="input" value={c.areaId} onChange={(e) => set('areaId', e.target.value)}>
              <option value="">Choose…</option>
              {db.areas.filter((a) => a.kind !== 'system').map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Objective">
            <select className="input" value={c.objective} onChange={(e) => setC((x) => ({ ...x, objective: e.target.value, successMetrics: undefined }))}>
              {Object.entries(OBJECTIVES).map(([k, o]) => (
                <option key={k} value={k}>
                  {o.label}
                </option>
              ))}
              {!(c.objective in OBJECTIVES) && <option value={c.objective}>{c.objective}</option>}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={c.status} onChange={(e) => set('status', e.target.value as CampaignStatus)}>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CAMPAIGN_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target audience">
            <input className="input" value={c.audience ?? ''} onChange={(e) => set('audience', e.target.value)} placeholder="Who this is for" />
          </Field>
          <Field label="Primary call to action">
            <input className="input" value={c.cta ?? ''} onChange={(e) => set('cta', e.target.value)} placeholder="e.g. Book a discovery call" />
          </Field>
          <Field label="Start date">
            <input type="date" className="input" value={c.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || undefined)} />
          </Field>
          <Field label="End date">
            <input type="date" className="input" value={c.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || undefined)} />
          </Field>
          <Field label="Campaign owner">
            <input className="input" value={c.owner ?? ''} onChange={(e) => set('owner', e.target.value)} placeholder="Who is responsible" />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="input" rows={2} value={c.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Platforms</p>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_PLATFORMS.map((ch) => (
              <button type="button" key={ch} aria-pressed={c.channels.includes(ch)} onClick={() => toggle(ch)} className={cn('chip cursor-pointer', c.channels.includes(ch) && 'border-glow/60 bg-glow/15 text-white')}>
                {CHANNEL_LABEL[ch]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Success measured by</p>
          <div className="flex flex-wrap gap-1.5">
            {['leads', 'inquiries', 'registrations', 'email_signups', 'reach', 'impressions', 'engagement', 'clicks', 'link_visits', 'conversions', 'revenue'].map((m) => (
              <button type="button" key={m} aria-pressed={metrics.includes(m)} onClick={() => toggleMetric(m)} className={cn('chip cursor-pointer', metrics.includes(m) && 'border-gold/50 bg-gold/10 text-gold')}>
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        {missingCampaignConfig({ ...c, id: '', createdAt: '', updatedAt: '' }).length > 0 && (
          <SetupList what="This campaign" items={missingCampaignConfig({ ...c, id: '', createdAt: '', updatedAt: '' })} />
        )}
        {error && (
          <p className="text-sm text-amber-200" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary">Save campaign</button>
        </div>
      </form>
    </Modal>
  )
}

export function CampaignLink({ id }: { id?: string }) {
  const db = useDB()
  const c = id ? db.campaigns.find((x) => x.id === id) : undefined
  if (!c) return <span className="text-muted">No campaign</span>
  return (
    <Link to={`/studio/campaigns/${c.id}`} className="hover:text-white hover:underline">
      {c.name}
    </Link>
  )
}
