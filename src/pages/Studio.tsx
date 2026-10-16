import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDB, useEMS } from '../app/EMSContext'
import {
  CAMPAIGN_STATUS_LABEL, CampaignForm, CampaignLink, ContentStatusBadge, FilterBar, StudioSetupNotice, emptyCampaign, useActor, useContentFilters,
} from '../components/studio'
import { AreaTag, Calm, PageHeader, Panel } from '../components/ui'
import { createCampaign, saveDraft } from '../data/contentOps'
import { CONTENT_STATUS_TONE, METRICS, filterCampaigns, filterContent, missingDrafts, objectiveLabel, overdueReason, summarizeMetrics } from '../domain/content'
import { CHANNEL_LABEL } from '../domain/labels'
import type { ContentItem } from '../domain/types'
import { useSearchState } from '../lib/urlState'
import { cn, friendlyDate, money, toDateKey } from '../lib/util'

type Tab = 'overview' | 'campaigns' | 'calendar' | 'reports'

export default function Studio() {
  const [params, update] = useSearchState()
  const tab = (params.get('tab') as Tab) || 'overview'
  const { store } = useEMS()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [f] = useContentFilters()
  const setTab = (t: Tab) => update((next) => next.set('tab', t))

  return (
    <div>
      <PageHeader
        eyebrow="Content Studio"
        title="Campaigns & content"
        sub="Plan campaigns, write and approve content, record what actually gets scheduled and published, and see real results. Approving never posts anything."
        actions={
          <>
            <Link to={`/studio/content/new${f.campaignId ? `?campaign=${f.campaignId}` : f.areaId ? `?area=${f.areaId}` : ''}`} className="btn-ghost">
              <Plus size={15} /> New draft
            </Link>
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> New campaign
            </button>
          </>
        }
      />
      <StudioSetupNotice />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {(
          [
            ['overview', 'Overview'],
            ['campaigns', 'Campaigns'],
            ['calendar', 'Content calendar'],
            ['reports', 'Reports'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={cn('btn-ghost py-1.5 text-xs', tab === k && 'border-glow/60 bg-glow/10 text-white')} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <FilterBar show={tab === 'campaigns' ? ['area', 'channel', 'campaignStatus', 'owner', 'dates'] : tab === 'reports' ? ['area', 'campaign', 'channel', 'dates'] : ['area', 'campaign', 'channel', 'status', 'owner', 'dates']} />
      {tab === 'overview' && <Overview />}
      {tab === 'campaigns' && <Campaigns onCreate={() => setCreating(true)} />}
      {tab === 'calendar' && <ContentCalendar />}
      {tab === 'reports' && <Reports />}

      <CampaignForm
        open={creating}
        title="New campaign"
        initial={emptyCampaign(f.areaId)}
        onClose={() => setCreating(false)}
        onSave={(c) => {
          const made = createCampaign(store, c)
          setCreating(false)
          navigate(`/studio/campaigns/${made.id}`)
        }}
      />
    </div>
  )
}

function ContentRow({ c, extra }: { c: ContentItem; extra?: string }) {
  const db = useDB()
  return (
    <li>
      <Link to={`/studio/content/${c.id}`} className="row">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-white">{c.title || 'Untitled draft'}</p>
          <p className="truncate text-xs text-muted">
            {db.areas.find((a) => a.id === c.areaId)?.name ?? 'No initiative'}
            {c.campaignId && ` · ${db.campaigns.find((x) => x.id === c.campaignId)?.name ?? ''}`}
            {c.channel && ` · ${CHANNEL_LABEL[c.channel]}`}
            {c.publishDate && ` · ${friendlyDate(c.publishDate)}`}
          </p>
          {extra && <p className="text-xs text-amber-200">{extra}</p>}
        </div>
        <ContentStatusBadge status={c.status} />
      </Link>
    </li>
  )
}

function useFiltered() {
  const db = useDB()
  const [f] = useContentFilters()
  return useMemo(() => ({ content: filterContent(db.content, f, db.campaigns), campaigns: filterCampaigns(db.campaigns, { areaId: f.areaId, channel: f.channel, owner: f.owner, from: f.from, to: f.to }), f }), [db, f])
}

function Overview() {
  const db = useDB()
  const { content, campaigns, f } = useFiltered()
  const today = toDateKey(new Date())
  const in14 = toDateKey(new Date(Date.now() + 14 * 86_400_000))
  const inCampaign = (c: ContentItem) => !f.campaignId || c.campaignId === f.campaignId
  const review = content.filter((c) => c.status === 'needs_review')
  const changes = content.filter((c) => c.status === 'changes_requested')
  const approved = content.filter((c) => c.status === 'approved')
  const upcoming = content.filter((c) => c.publishDate && c.publishDate >= today && c.publishDate <= in14 && c.status !== 'archived' && c.status !== 'published').sort((a, b) => a.publishDate!.localeCompare(b.publishDate!))
  const published = content.filter((c) => c.status === 'published').sort((a, b) => (b.publishing?.publishedAt ?? '').localeCompare(a.publishing?.publishedAt ?? ''))
  const overdue = content.map((c) => ({ c, why: overdueReason(c) })).filter((x) => x.why)
  const missing = missingDrafts({ campaigns, content: db.content }).filter((m) => (!f.campaignId || m.campaign.id === f.campaignId) && (!f.channel || m.channel === f.channel))
  const active = campaigns.filter((c) => c.status === 'active' && (!f.campaignId || c.id === f.campaignId))

  if (!db.campaigns.length && !db.content.length) {
    return <Calm>No campaigns or content yet. Start with “New campaign” — pick the initiative, objective and audience, and EMS will help you plan and draft the content.</Calm>
  }
  const stats: [string, number, string][] = [
    ['Active campaigns', active.length, 'text-white'],
    ['Waiting for approval', review.length, 'text-gold'],
    ['Approved, not scheduled', approved.length, 'text-emerald-300'],
    ['Planned in next 14 days', upcoming.length, 'text-white'],
    ['Overdue', overdue.length, overdue.length ? 'text-rose-300' : 'text-white'],
  ]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map(([l, n, tone]) => (
          <div key={l} className="glass p-3.5">
            <p className={cn('display text-3xl', tone)}>{n}</p>
            <p className="text-[11px] text-muted">{l}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Waiting for approval" action={<Link to="/team" className="text-xs text-muted hover:text-white">Approve in My AI Team →</Link>}>
          {review.filter(inCampaign).length ? <ul className="-mx-3">{review.filter(inCampaign).map((c) => <ContentRow key={c.id} c={c} />)}</ul> : <Calm>Nothing waiting for approval.</Calm>}
          {changes.length > 0 && (
            <>
              <p className="label mt-4 mb-1">Changes requested</p>
              <ul className="-mx-3">{changes.filter(inCampaign).map((c) => <ContentRow key={c.id} c={c} extra={c.changesRequestedReason} />)}</ul>
            </>
          )}
        </Panel>
        <Panel title="Approved — waiting to be scheduled" hint="Schedule these on the platform, then record it here.">
          {approved.filter(inCampaign).length ? <ul className="-mx-3">{approved.filter(inCampaign).map((c) => <ContentRow key={c.id} c={c} />)}</ul> : <Calm>Nothing approved and waiting.</Calm>}
        </Panel>
        <Panel title="Upcoming planned dates" hint="Next 14 days. Planned dates are internal — not an external schedule.">
          {upcoming.filter(inCampaign).length ? <ul className="-mx-3">{upcoming.filter(inCampaign).map((c) => <ContentRow key={c.id} c={c} />)}</ul> : <Calm>Nothing planned in the next two weeks.</Calm>}
        </Panel>
        <Panel title="Needs attention" hint="Overdue approvals and platforms with no draft yet.">
          {overdue.length || missing.length ? (
            <ul className="-mx-3">
              {overdue.filter((x) => inCampaign(x.c)).map(({ c, why }) => (
                <ContentRow key={c.id} c={c} extra={why!} />
              ))}
              {missing.map((m) => (
                <li key={`${m.campaign.id}_${m.channel}`}>
                  <Link to={`/studio/content/new?campaign=${m.campaign.id}&channel=${m.channel}`} className="row">
                    <div className="flex-1">
                      <p className="text-sm text-white">No {CHANNEL_LABEL[m.channel]} draft yet</p>
                      <p className="text-xs text-muted">{m.campaign.name}</p>
                    </div>
                    <span className="chip">Start one</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Calm>Nothing overdue, and every active campaign platform has a draft.</Calm>
          )}
        </Panel>
        <Panel title="Recently published (recorded)">
          {published.filter(inCampaign).length ? (
            <ul className="-mx-3">{published.filter(inCampaign).slice(0, 6).map((c) => <ContentRow key={c.id} c={c} extra={c.publishing?.url ? undefined : 'No link recorded'} />)}</ul>
          ) : (
            <Calm>Nothing recorded as published yet.</Calm>
          )}
        </Panel>
        <Panel title="Campaign results" hint="Only numbers someone entered, with their source.">
          {active.length ? (
            <ul className="space-y-3">
              {active.map((c) => {
                const s = summarizeMetrics(c, db.campaignMetrics).filter((m) => m.actual !== null || m.target !== null)
                return (
                  <li key={c.id}>
                    <Link to={`/studio/campaigns/${c.id}`} className="text-sm text-white hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {s.length ? s.map((m) => `${METRICS[m.metric]?.label ?? m.metric}: ${m.actual ?? '—'}${m.target !== null ? ` of ${m.target} target` : ''}`).join(' · ') : 'No results entered yet.'}
                    </p>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Calm>No active campaigns.</Calm>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Campaigns({ onCreate }: { onCreate: () => void }) {
  const db = useDB()
  const [f] = useContentFilters()
  const list = filterCampaigns(db.campaigns, { areaId: f.areaId, channel: f.channel, status: f.status, owner: f.owner, from: f.from, to: f.to })
  if (!db.campaigns.length)
    return (
      <Calm>
        No campaigns yet.{' '}
        <button className="text-glow hover:underline" onClick={onCreate}>
          Create the first one
        </button>
        .
      </Calm>
    )
  if (!list.length) return <Calm>No campaigns match these filters.</Calm>
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {list.map((c) => {
        const items = db.content.filter((x) => x.campaignId === c.id)
        return (
          <Link key={c.id} to={`/studio/campaigns/${c.id}`} className="glass block p-4 transition-colors hover:border-glow/40">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-white">{c.name}</p>
              <span className="chip">{CAMPAIGN_STATUS_LABEL[c.status] ?? c.status}</span>
            </div>
            <AreaTag area={db.areas.find((a) => a.id === c.areaId)} />
            <p className="mt-2 text-xs text-muted">{objectiveLabel(c.objective)}</p>
            <p className="mt-1 text-xs text-muted">
              {c.channels.map((ch) => CHANNEL_LABEL[ch]).join(', ') || 'No platforms'}
              {(c.startDate || c.endDate) && ` · ${c.startDate ? friendlyDate(c.startDate) : '…'} – ${c.endDate ? friendlyDate(c.endDate) : '…'}`}
            </p>
            <p className="mt-2 text-xs text-muted">
              {items.length} piece{items.length === 1 ? '' : 's'} · {items.filter((x) => x.status === 'needs_review').length} waiting for approval · {items.filter((x) => x.status === 'published').length} published
            </p>
          </Link>
        )
      })}
    </div>
  )
}

function ContentCalendar() {
  const db = useDB()
  const { store } = useEMS()
  const actor = useActor()
  const [f] = useContentFilters()
  const [params, update] = useSearchState()
  const view = params.get('view') === 'list' ? 'list' : 'month'
  const setView = (v: 'month' | 'list') => update((next) => next.set('view', v))
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Month view always shows the month; the date filters apply to the list.
  const base = filterContent(db.content, { ...f, from: undefined, to: undefined }, db.campaigns).filter((c) => c.status !== 'archived')
  const dated = base.filter((c) => c.publishDate)
  const undated = base.filter((c) => !c.publishDate)
  const listItems = filterContent(dated, { from: f.from, to: f.to }).sort((a, b) => a.publishDate!.localeCompare(b.publishDate!))
  const days = useMemo(() => {
    const first = new Date(cursor)
    first.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i))
  }, [cursor])
  const todayKey = toDateKey(new Date())

  const move = async (c: ContentItem, date: string) => {
    const r = await saveDraft(store, c.id, { publishDate: date || undefined }, actor.name)
    setMsg(r.ok ? { ok: true, text: `Moved “${c.title}” to ${date ? friendlyDate(date) : 'no date'}.` } : { ok: false, text: r.error })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost px-2.5" aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
          <ChevronLeft size={16} />
        </button>
        <p className="display min-w-40 text-center text-xl">{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
        <button className="btn-ghost px-2.5" aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
          <ChevronRight size={16} />
        </button>
        <div className="ml-auto flex gap-1">
          {(['month', 'list'] as const).map((v) => (
            <button key={v} className={cn('btn-ghost py-1.5 text-xs capitalize', view === v && 'border-glow/60 bg-glow/10 text-white')} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted">These are planned dates inside EMS. Something is only “scheduled” once you’ve scheduled it on the platform and recorded it.</p>
      {msg && (
        <p role="status" className={cn('text-xs', msg.ok ? 'text-emerald-300' : 'text-amber-200')}>
          {msg.text}
        </p>
      )}

      {view === 'month' ? (
        <div className="glass overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-line text-center text-[11px] text-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const k = toDateKey(d)
              const items = dated.filter((c) => c.publishDate === k)
              return (
                <div key={k} className={cn('min-h-20 border-b border-r border-line p-1 sm:min-h-28', d.getMonth() !== cursor.getMonth() && 'opacity-35')}>
                  <span className={cn('inline-grid h-6 w-6 place-items-center rounded-full text-xs', k === todayKey ? 'bg-glow text-white' : 'text-mist')}>{d.getDate()}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {items.slice(0, 4).map((c) => (
                      <Link key={c.id} to={`/studio/content/${c.id}`} title={`${c.title} — ${c.status}`} className={cn('block truncate rounded border px-1 text-[10px]', CONTENT_STATUS_TONE[c.status], overdueReason(c) && 'ring-1 ring-rose-400/60')}>
                        {c.channel ? `${CHANNEL_LABEL[c.channel]}: ` : ''}
                        {c.title || 'Untitled'}
                      </Link>
                    ))}
                    {items.length > 4 && <p className="text-[10px] text-muted">+{items.length - 4} more</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <Panel title="Planned content">
          {listItems.length ? (
            <ul className="divide-y divide-line">
              {listItems.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <input type="date" className="input w-auto py-1 text-xs" value={c.publishDate ?? ''} onChange={(e) => move(c, e.target.value)} aria-label={`Planned date for ${c.title}`} disabled={c.status === 'published'} />
                  <Link to={`/studio/content/${c.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white hover:underline">{c.title || 'Untitled'}</p>
                    <p className="truncate text-xs text-muted">
                      {c.channel ? CHANNEL_LABEL[c.channel] : 'No platform'} · <CampaignLink id={c.campaignId} />
                      {overdueReason(c) && <span className="text-rose-300"> · {overdueReason(c)}</span>}
                    </p>
                  </Link>
                  <ContentStatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          ) : (
            <Calm>No planned content matches these filters.</Calm>
          )}
        </Panel>
      )}
      {undated.length > 0 && (
        <Panel title={`No planned date · ${undated.length}`}>
          <ul className="divide-y divide-line">
            {undated.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                <input type="date" className="input w-auto py-1 text-xs" value="" onChange={(e) => move(c, e.target.value)} aria-label={`Planned date for ${c.title}`} />
                <Link to={`/studio/content/${c.id}`} className="flex-1 truncate text-sm text-white hover:underline">
                  {c.title || 'Untitled'}
                </Link>
                <ContentStatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}

function Reports() {
  const db = useDB()
  const { f } = useFiltered()
  const camps = filterCampaigns(db.campaigns, { areaId: f.areaId, channel: f.channel, from: f.from, to: f.to }).filter((c) => !f.campaignId || c.id === f.campaignId)
  const inPeriod = (d?: string) => (!f.from || (d ?? '') >= f.from) && (!f.to || (d ?? '') <= f.to)
  const metricRows = db.campaignMetrics.filter((m) => camps.some((c) => c.id === m.campaignId) && (m.kind === 'target' || inPeriod(m.periodEnd ?? m.periodStart ?? m.createdAt.slice(0, 10))))
  const areas = db.areas.filter((a) => camps.some((c) => c.areaId === a.id))
  const fmt = (metric: string, v: number | null) => (v === null ? '—' : METRICS[metric]?.money ? money(v) : v.toLocaleString())

  if (!camps.length) return <Calm>No campaigns match these filters, so there’s nothing to report.</Calm>
  return (
    <div className="space-y-5">
      <Panel title="Portfolio summary" hint="Actual results only, as entered with their sources. Targets are shown separately.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Initiative</th>
                <th className="py-2 pr-3 font-medium">Campaigns</th>
                <th className="py-2 pr-3 font-medium">Published</th>
                <th className="py-2 font-medium">Results entered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {areas.map((a) => {
                const ac = camps.filter((c) => c.areaId === a.id)
                const rows = metricRows.filter((m) => m.kind === 'actual' && ac.some((c) => c.id === m.campaignId))
                const totals = new Map<string, number>()
                for (const r of rows) totals.set(r.metric, (totals.get(r.metric) ?? 0) + r.value)
                const pub = db.content.filter((x) => x.status === 'published' && ac.some((c) => c.id === x.campaignId) && inPeriod(x.publishing?.publishedAt?.slice(0, 10))).length
                return (
                  <tr key={a.id}>
                    <td className="py-2.5 pr-3 text-white">{a.name}</td>
                    <td className="py-2.5 pr-3 text-mist">{ac.length}</td>
                    <td className="py-2.5 pr-3 text-mist">{pub}</td>
                    <td className="py-2.5 text-xs text-mist">{totals.size ? [...totals].map(([k, v]) => `${METRICS[k]?.label ?? k}: ${fmt(k, v)}`).join(' · ') : <span className="text-muted">None entered</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      {camps.map((c) => {
        const s = summarizeMetrics(c, metricRows)
        return (
          <Panel key={c.id} title={c.name} hint={`${db.areas.find((a) => a.id === c.areaId)?.name ?? ''} · ${objectiveLabel(c.objective)}`} action={<Link to={`/studio/campaigns/${c.id}#results`} className="text-xs text-muted hover:text-white">Enter results →</Link>}>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {s.map((m) => (
                <div key={m.metric} className="rounded-xl bg-white/[0.03] p-2.5">
                  <p className="text-[11px] text-muted">{METRICS[m.metric]?.label ?? m.metric}</p>
                  <p className="display text-2xl text-white">{fmt(m.metric, m.actual)}</p>
                  <p className="text-[10px] text-muted">
                    {m.target !== null ? `Target ${fmt(m.metric, m.target)}` : 'No target'}
                    {m.actual !== null && ` · ${m.sources.join(', ')}`}
                  </p>
                </div>
              ))}
            </div>
            {c.metrics && Object.keys(c.metrics).length > 0 && (
              <p className="mt-2 text-[11px] text-muted">
                Older numbers on this campaign (source not recorded): {Object.entries(c.metrics).map(([k, v]) => `${k} ${v}`).join(', ')}
              </p>
            )}
          </Panel>
        )
      })}
      <p className="text-[11px] text-muted">
        Performance numbers aren’t pulled from Meta, TikTok, YouTube or email platforms automatically — those connections don’t exist yet. Enter results from each platform’s insights on the campaign page.
      </p>
    </div>
  )
}
