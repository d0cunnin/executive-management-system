// Initiative workspace sections: campaigns and content, brand and setup,
// people and events. Generic for every initiative, so new initiatives need
// no code changes.
import { Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDB, useEMS } from '../app/EMSContext'
import { createCampaign } from '../data/contentOps'
import { CONTENT_PLATFORMS, REQUIRED_WORKSTREAMS, missingBrandConfig, objectiveLabel, overdueReason, workstreamLabel } from '../domain/content'
import { CHANNEL_LABEL } from '../domain/labels'
import type { Area, BrandSettings, Channel, Workstream } from '../domain/types'
import { cn, friendlyDate, timeOf } from '../lib/util'
import { CAMPAIGN_STATUS_LABEL, CampaignForm, ContentStatusBadge, SetupList, StudioSetupNotice, emptyCampaign } from './studio'
import { Calm, Field, Modal, Panel } from './ui'

export function InitiativeCampaigns({ area }: { area: Area }) {
  const db = useDB()
  const { store } = useEMS()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const campaigns = db.campaigns.filter((c) => c.areaId === area.id)
  const content = db.content.filter((c) => (c.areaId ?? db.campaigns.find((x) => x.id === c.campaignId)?.areaId) === area.id && c.status !== 'archived')
  const upcoming = content.filter((c) => c.publishDate && c.status !== 'published').sort((a, b) => a.publishDate!.localeCompare(b.publishDate!)).slice(0, 8)
  const q = `area=${area.id}`
  return (
    <div className="space-y-5">
      <StudioSetupNotice />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> New campaign
        </button>
        <Link to={`/studio/content/new?${q}`} className="btn-ghost">
          <Plus size={15} /> New draft
        </Link>
        <Link to={`/studio?tab=calendar&${q}`} className="btn-ghost">
          Publishing calendar
        </Link>
        <Link to={`/studio?tab=reports&${q}`} className="btn-ghost">
          Reports
        </Link>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={`Campaigns · ${campaigns.length}`}>
          {campaigns.length ? (
            <ul className="-mx-3">
              {campaigns.map((c) => {
                const mine = db.content.filter((x) => x.campaignId === c.id)
                return (
                  <li key={c.id}>
                    <Link to={`/studio/campaigns/${c.id}`} className="row">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{c.name}</p>
                        <p className="truncate text-xs text-muted">
                          {objectiveLabel(c.objective)} · {mine.length} piece{mine.length === 1 ? '' : 's'} · {mine.filter((x) => x.status === 'needs_review').length} waiting
                        </p>
                      </div>
                      <span className="chip">{CAMPAIGN_STATUS_LABEL[c.status] ?? c.status}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Calm>No campaigns for {area.name} yet.</Calm>
          )}
        </Panel>
        <Panel title="Planned content">
          {upcoming.length ? (
            <ul className="-mx-3">
              {upcoming.map((c) => (
                <li key={c.id}>
                  <Link to={`/studio/content/${c.id}`} className="row">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{c.title || 'Untitled'}</p>
                      <p className="truncate text-xs text-muted">
                        {c.publishDate && friendlyDate(c.publishDate)} · {c.channel ? CHANNEL_LABEL[c.channel] : 'No platform'}
                        {overdueReason(c) && <span className="text-rose-300"> · {overdueReason(c)}</span>}
                      </p>
                    </div>
                    <ContentStatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Calm>No planned content.</Calm>
          )}
        </Panel>
      </div>
      <CampaignForm
        open={creating}
        title={`New ${area.name} campaign`}
        initial={emptyCampaign(area.id)}
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

const split = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

/** Brand and campaign guidance for one initiative. Empty fields stay empty; nothing is filled with placeholders. */
export function BrandSetup({ area }: { area: Area }) {
  const db = useDB()
  const { store } = useEMS()
  const existing = db.brandSettings.find((b) => b.areaId === area.id)
  const learningAreas = db.learningAreas.filter((l) => l.areaId === area.id)
  const usesLearningAreas = area.id === 'area_dbm'
  const req = REQUIRED_WORKSTREAMS[area.id]
  const init = () => ({
    description: existing?.description ?? '',
    audience: existing?.audience ?? '',
    tone: existing?.tone ?? '',
    mission: existing?.mission ?? '',
    messaging: existing?.messaging ?? '',
    ctas: (existing?.approvedCtas ?? []).join('\n'),
    links: (existing?.approvedLinks ?? []).join('\n'),
    restrictions: existing?.restrictions ?? '',
    assets: existing?.assets ?? [],
    guidance: { ...(existing?.platformGuidance ?? {}) } as Partial<Record<Channel, string>>,
    workstreams: existing?.workstreams ?? ([] as Workstream[]),
  })
  const [f, setF] = useState(init)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const gaps = missingBrandConfig(area, existing)
  const dirty = JSON.stringify(f) !== JSON.stringify(init())

  const save = async () => {
    setBusy(true)
    const data: Omit<BrandSettings, 'id' | 'createdAt' | 'updatedAt'> = {
      areaId: area.id,
      description: f.description.trim() || undefined,
      audience: f.audience.trim() || undefined,
      tone: f.tone.trim() || undefined,
      mission: f.mission.trim() || undefined,
      messaging: f.messaging.trim() || undefined,
      approvedCtas: split(f.ctas),
      approvedLinks: split(f.links),
      restrictions: f.restrictions.trim() || undefined,
      assets: f.assets.filter((a) => a.label.trim() || a.url?.trim()),
      platformGuidance: Object.fromEntries(Object.entries(f.guidance).filter(([, v]) => v?.trim())),
      workstreams: f.workstreams.filter((w) => w.name.trim()),
    }
    try {
      if (existing) await store.updateConfirmed('brandSettings', existing.id, data)
      else await store.createConfirmed('brandSettings', data)
      setMsg({ ok: true, text: 'Saved.' })
    } catch (e) {
      setMsg({ ok: false, text: `Not saved: ${e instanceof Error ? e.message : String(e)}` })
    }
    setBusy(false)
  }

  const t = (k: 'description' | 'audience' | 'tone' | 'mission' | 'messaging' | 'restrictions' | 'ctas' | 'links', label: string, rows = 2, hint?: string) => (
    <Field label={label} hint={hint}>
      <textarea className="input" rows={rows} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </Field>
  )

  return (
    <div className="space-y-5">
      <StudioSetupNotice />
      {gaps.length > 0 ? (
        <SetupList what={`${area.name} setup`} items={gaps} />
      ) : (
        <p className="text-xs text-emerald-300">Brand settings are complete. Assistants use them for every {area.name} draft.</p>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Brand & message" hint="Used by you and your assistants. Leave anything unknown blank — assistants will ask rather than guess.">
          <div className="space-y-3">
            {t('description', 'What this initiative is')}
            {t('audience', 'Audience')}
            {t('tone', 'Tone and voice')}
            {t('mission', 'Mission')}
            {t('messaging', 'Core messaging', 3)}
            {t('ctas', 'Approved calls to action', 3, 'One per line.')}
            {t('links', 'Approved links', 2, 'One per line.')}
            {t('restrictions', 'Content restrictions', 2, 'What content must never say or do.')}
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel title={workstreamLabel(area.id)} hint={req?.count ? `${area.name} has ${req.count}. Only you can name them.` : 'Programs, pathways or workstreams inside this initiative.'}>
            {usesLearningAreas ? (
              <p className="text-sm text-mist">
                DBM’s learning areas are managed on the Overview tab ({learningAreas.length} of 5 named: {learningAreas.map((l) => l.name).join(', ') || 'none'}).
              </p>
            ) : (
              <>
                <ul className="space-y-2">
                  {f.workstreams.map((w, i) => (
                    <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                      <input className="input py-1.5 text-xs" value={w.name} placeholder="Name" aria-label={`${workstreamLabel(area.id)} name`} onChange={(e) => setF({ ...f, workstreams: f.workstreams.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                      <input className="input py-1.5 text-xs" value={w.description ?? ''} placeholder="Short description (optional)" aria-label="Description" onChange={(e) => setF({ ...f, workstreams: f.workstreams.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                      <button className="btn-ghost px-2 py-1 text-xs" aria-label="Remove" onClick={() => setF({ ...f, workstreams: f.workstreams.filter((_, j) => j !== i) })}>
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
                {req?.count && f.workstreams.filter((w) => w.name.trim()).length < req.count && (
                  <p className="mt-2 text-xs text-amber-200">
                    {req.count - f.workstreams.filter((w) => w.name.trim()).length} still to name. EMS won’t guess them.
                  </p>
                )}
                <button className="btn-ghost mt-2 py-1 text-xs" onClick={() => setF({ ...f, workstreams: [...f.workstreams, { name: '' }] })}>
                  <Plus size={12} /> Add
                </button>
                {req?.suggestions && (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] text-muted">Suggested workstreams — add only the ones that are real for {area.name}:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {req.suggestions
                        .filter((s) => !f.workstreams.some((w) => w.name === s))
                        .map((s) => (
                          <button key={s} className="chip cursor-pointer hover:text-white" onClick={() => setF({ ...f, workstreams: [...f.workstreams, { name: s }] })}>
                            + {s}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Panel>
          <Panel title="Platform guidance" hint="Anything specific to a platform: format, handle, posting link, what works.">
            <div className="space-y-2">
              {CONTENT_PLATFORMS.map((ch) => (
                <Field key={ch} label={CHANNEL_LABEL[ch]}>
                  <input className="input py-1.5 text-xs" value={f.guidance[ch] ?? ''} onChange={(e) => setF({ ...f, guidance: { ...f.guidance, [ch]: e.target.value } })} placeholder={ch === 'email' ? 'Include your email platform link here' : ''} />
                </Field>
              ))}
            </div>
          </Panel>
          <Panel title="Brand assets" hint="Links to logos, templates, photos.">
            <ul className="space-y-2">
              {f.assets.map((a, i) => (
                <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                  <input className="input py-1.5 text-xs" value={a.label} placeholder="Label" aria-label="Asset label" onChange={(e) => setF({ ...f, assets: f.assets.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <input className="input py-1.5 text-xs" value={a.url ?? ''} placeholder="https://…" aria-label="Asset link" onChange={(e) => setF({ ...f, assets: f.assets.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                  <button className="btn-ghost px-2 py-1 text-xs" aria-label="Remove asset" onClick={() => setF({ ...f, assets: f.assets.filter((_, j) => j !== i) })}>
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn-ghost mt-2 py-1 text-xs" onClick={() => setF({ ...f, assets: [...f.assets, { label: '' }] })}>
              <Plus size={12} /> Add asset link
            </button>
          </Panel>
        </div>
      </div>
      <div className="sticky bottom-24 flex items-center gap-3 lg:bottom-4">
        <button className="btn-primary" disabled={busy || !dirty} onClick={save}>
          Save {area.name} settings
        </button>
        {dirty && <span className="chip text-gold">Unsaved changes</span>}
        {msg && (
          <span role="status" className={cn('text-xs', msg.ok ? 'text-emerald-300' : 'text-amber-200')}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  )
}

const PERSON_ROLES = ['Speaker', 'Partner', 'Sponsor', 'Vendor', 'Volunteer', 'Facilitator', 'Contact']

export function PeopleAndEvents({ area }: { area: Area }) {
  const db = useDB()
  const { store } = useEMS()
  const people = db.contacts.filter((c) => c.areaIds.includes(area.id))
  const today = new Date().toISOString().slice(0, 10)
  const events = db.events.filter((e) => e.areaId === area.id && e.start.slice(0, 10) >= today).sort((a, b) => a.start.localeCompare(b.start))
  const [p, setP] = useState({ name: '', role: 'Partner', organization: '', email: '', notes: '' })
  const [adding, setAdding] = useState(false)
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title={`People & partners · ${people.length}`} hint="Speakers, partners, sponsors and contacts for this initiative." action={<button className="btn-ghost py-1 text-xs" onClick={() => setAdding(true)}><Plus size={12} /> Add</button>}>
        {people.length ? (
          <ul className="-mx-3">
            {people.map((c) => (
              <li key={c.id} className="row items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{c.name}</p>
                  <p className="text-xs text-muted">
                    {[c.role, c.organization, c.email].filter(Boolean).join(' · ')}
                  </p>
                  {c.notes && <p className="text-xs text-muted">{c.notes}</p>}
                </div>
                <button className="text-muted hover:text-rose-300" aria-label={`Remove ${c.name}`} onClick={() => window.confirm(`Remove ${c.name}?`) && store.remove('contacts', c.id)}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Calm>No one recorded for {area.name} yet. Only add real people and confirmed partners.</Calm>
        )}
      </Panel>
      <Panel title="Upcoming events" action={<Link to="/calendar" className="text-xs text-muted hover:text-white">Calendar →</Link>}>
        {events.length ? (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="w-28 shrink-0 text-xs text-muted">
                  {friendlyDate(e.start)} {timeOf(e.start)}
                </span>
                <span className="text-white">{e.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Calm>Nothing on the calendar for {area.name}.</Calm>
        )}
      </Panel>
      <Modal open={adding} onClose={() => setAdding(false)} title={`Add to ${area.name}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!p.name.trim()) return
            store.create('contacts', { name: p.name.trim(), role: p.role, organization: p.organization || undefined, email: p.email || undefined, notes: p.notes || undefined, areaIds: [area.id] })
            setP({ name: '', role: 'Partner', organization: '', email: '', notes: '' })
            setAdding(false)
          }}
        >
          <Field label="Name">
            <input autoFocus className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <select className="input" value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })}>
                {PERSON_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Organization">
              <input className="input" value={p.organization} onChange={(e) => setP({ ...p, organization: e.target.value })} />
            </Field>
          </div>
          <Field label="Email (optional)">
            <input type="email" className="input" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} />
          </Field>
          <Field label="Notes (optional)">
            <input className="input" value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <button className="btn-primary">Add</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

const COLORS = ['#fb923c', '#a78bfa', '#38bdf8', '#f472b6', '#34d399', '#facc15', '#f87171', '#67e8f9']

/** Add an initiative without a code change. */
export function NewInitiativeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDB()
  const { store } = useEMS()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [kind, setKind] = useState<Area['kind']>('standalone')
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal open={open} onClose={onClose} title="New initiative">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const n = name.trim()
          if (!n) return setError('Give it a name.')
          const slug = n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
          if (db.areas.some((a) => a.slug === slug || a.name.toLowerCase() === n.toLowerCase())) return setError('An initiative with that name already exists.')
          try {
            await store.createConfirmed('areas', { id: `area_${slug}`, slug, name: n, kind, tagline: tagline.trim(), focuses: [], color: COLORS[db.areas.length % COLORS.length], connectedAreaIds: [] })
            setName('')
            setTagline('')
            onClose()
            navigate(`/areas/${slug}?tab=brand`)
          } catch (err) {
            setError(`Not saved: ${err instanceof Error ? err.message : String(err)}`)
          }
        }}
      >
        <Field label="Name">
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="One line about it (optional)">
          <input className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </Field>
        <Field label="Type">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Area['kind'])}>
            <option value="standalone">Standalone initiative</option>
            <option value="organization">Organization</option>
            <option value="function">Function (like Books or Content)</option>
            <option value="personal">Personal</option>
            <option value="school">School</option>
          </select>
        </Field>
        {error && (
          <p role="alert" className="text-sm text-amber-200">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <button className="btn-primary">Create initiative</button>
        </div>
      </form>
    </Modal>
  )
}
