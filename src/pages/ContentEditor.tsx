import { Copy, ExternalLink, History, Loader2, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDB, useEMS } from '../app/EMSContext'
import { AGENT_NAMES, CampaignLink, ContentStatusBadge, SetupList, StudioSetupNotice, useActor } from '../components/studio'
import { AreaTag, Calm, DemoTag, Field, Modal, Panel } from '../components/ui'
import { createDraftConfirmed, moveContent, saveDraft } from '../data/contentOps'
import {
  CONTENT_PLATFORMS, CONTENT_STATUS_LABEL, PLATFORM_SHAPE, allowedTransitions, isCopyLocked, missingBrandConfig, objectiveLabel, publishingDestination,
  type DraftEdit,
} from '../domain/content'
import { CHANNEL_LABEL } from '../domain/labels'
import type { Channel, ContentItem, ContentStatus, MediaRef } from '../domain/types'
import { cn, friendlyDate } from '../lib/util'

const KINDS: ContentItem['kind'][] = ['post', 'reel', 'carousel', 'short', 'video', 'article', 'email']

type Msg = { ok: boolean; text: string } | null

export default function ContentEditor() {
  const { id } = useParams()
  const db = useDB()
  const item = id === 'new' ? undefined : db.content.find((c) => c.id === id)
  // Kept here so confirmations survive the form refreshing after a save.
  const [msg, setMsg] = useState<Msg>(null)
  if (id !== 'new' && !item) return <Calm>That draft doesn’t exist. It may have been removed.</Calm>
  // Re-mount the form whenever a new version is saved, so it shows what's stored.
  return <Editor key={item ? `${item.id}:${item.version ?? 1}` : 'new'} item={item} msg={msg} setMsg={setMsg} />
}

function Editor({ item, msg, setMsg }: { item?: ContentItem; msg: Msg; setMsg: (m: Msg) => void }) {
  const db = useDB()
  const { store } = useEMS()
  const actor = useActor()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetCampaign = params.get('campaign') ?? undefined
  const campaignForNew = presetCampaign ? db.campaigns.find((c) => c.id === presetCampaign) : undefined

  const initial: DraftEdit = useMemo(
    () =>
      item
        ? {
            title: item.title, body: item.body ?? '', cta: item.cta ?? '', hashtags: item.hashtags ?? [], publishDate: item.publishDate, channel: item.channel,
            campaignId: item.campaignId, areaId: item.areaId, media: item.media ?? [], subject: item.subject ?? '', previewText: item.previewText ?? '',
            audience: item.audience ?? '', listRef: item.listRef ?? '', owner: item.owner ?? '', kind: item.kind,
          }
        : {
            title: '', body: '', cta: campaignForNew?.cta ?? '', hashtags: [], publishDate: undefined, channel: (params.get('channel') as Channel) || campaignForNew?.channels[0],
            campaignId: presetCampaign, areaId: campaignForNew?.areaId ?? params.get('area') ?? undefined, media: [], subject: '', previewText: '',
            audience: campaignForNew?.audience ?? '', listRef: '', owner: actor.name, kind: 'post',
          },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item],
  )
  const [f, setF] = useState<DraftEdit>(initial)
  const [busy, setBusy] = useState(false)
  const [reasonFor, setReasonFor] = useState<ContentStatus | null>(null)
  const [reason, setReason] = useState('')
  const [historyOpen, setHistoryOpen] = useState(params.get('history') === '1')

  const clean = (d: DraftEdit) => JSON.stringify({ ...d, hashtags: d.hashtags ?? [], media: d.media ?? [] })
  const dirty = clean(f) !== clean(initial)
  const set = <K extends keyof DraftEdit>(k: K, v: DraftEdit[K]) => setF((x) => ({ ...x, [k]: v }))
  const locked = item ? isCopyLocked(item.status) : false
  const campaign = f.campaignId ? db.campaigns.find((c) => c.id === f.campaignId) : undefined
  const area = db.areas.find((a) => a.id === (f.areaId ?? campaign?.areaId))
  const brand = area ? db.brandSettings.find((b) => b.areaId === area.id) : undefined
  const brandGaps = area ? missingBrandConfig(area, brand) : []
  const isEmail = f.channel === 'email'

  // Never silently drop unsaved changes: block in-app navigation and tab closing.
  const justSaved = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !justSaved.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** Only send fields that differ, with empty strings as "not set". */
  const changes = (): DraftEdit => {
    const out: DraftEdit = {}
    for (const k of Object.keys(f) as (keyof DraftEdit)[]) {
      const v = typeof f[k] === 'string' && (f[k] as string).trim() === '' && k !== 'body' && k !== 'title' ? undefined : f[k]
      if (JSON.stringify(v ?? null) !== JSON.stringify((item?.[k as keyof ContentItem] as unknown) ?? null)) (out as Record<string, unknown>)[k] = v
    }
    return out
  }

  const save = async (): Promise<string | null> => {
    if (!f.title?.trim()) {
      setMsg({ ok: false, text: 'Give it a title first.' })
      return null
    }
    if (!item) {
      const r = await createDraftConfirmed(store, { ...(changes() as Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'version'>), title: f.title.trim(), kind: f.kind ?? 'post', engine: 'manual' }, actor.name)
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return null
      }
      justSaved.current = true
      setMsg({ ok: true, text: 'Draft created and saved.' })
      return r.item.id
    }
    const edit = changes()
    if (!Object.keys(edit).length) return item.id
    const r = await saveDraft(store, item.id, edit, actor.name)
    if (!r.ok) {
      setMsg({ ok: false, text: r.error })
      return null
    }
    setMsg({ ok: true, text: r.message ?? 'Saved.' })
    return item.id
  }

  const onSave = async () => {
    setBusy(true)
    const savedId = await save()
    setBusy(false)
    if (savedId && !item) navigate(`/studio/content/${savedId}`, { replace: true })
  }

  const move = async (to: ContentStatus, extra: { reason?: string; publishing?: ContentItem['publishing'] } = {}) => {
    setBusy(true)
    const savedId = dirty || !item ? await save() : item.id
    if (!savedId) return setBusy(false)
    const r = await moveContent(store, savedId, to, { role: actor.role, by: actor.name, ...extra })
    setBusy(false)
    if (!r.ok) return setMsg({ ok: false, text: r.error })
    setReasonFor(null)
    setReason('')
    setMsg({ ok: true, text: `Now: ${CONTENT_STATUS_LABEL[to]}.` })
    if (!item) navigate(`/studio/content/${savedId}`, { replace: true })
  }

  const status: ContentStatus = item?.status ?? 'draft'
  const transitions = allowedTransitions(status, actor.role).filter((t) => t.to !== 'scheduled' && t.to !== 'published')
  const guidance = f.channel ? PLATFORM_SHAPE[f.channel] : undefined
  const ownGuidance = f.channel ? brand?.platformGuidance?.[f.channel] : undefined

  return (
    <div className="space-y-5">
      <div className="rise">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button className="text-muted hover:text-white" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <AreaTag area={area} />
          {item && <DemoTag show={item.demo} />}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="display text-3xl sm:text-4xl">{item ? 'Edit draft' : 'New draft'}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <ContentStatusBadge status={status} />
            {dirty && <span className="chip text-gold">Unsaved changes</span>}
          </div>
        </div>
      </div>
      <StudioSetupNotice />
      {msg && (
        <p role="status" className={cn('rounded-xl border px-3 py-2 text-sm', msg.ok ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/30 bg-amber-400/10 text-amber-100')}>
          {msg.text}
        </p>
      )}
      {item?.status === 'changes_requested' && item.changesRequestedReason && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">Changes requested: {item.changesRequestedReason}</p>
      )}
      {locked && <p className="text-xs text-muted">This has been {status === 'archived' ? 'archived' : `recorded as ${status}`}, so the copy is locked. You can still update the planned date and publishing details.</p>}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Draft">
            <div className="space-y-3">
              <Field label="Title">
                <input className="input" value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} disabled={locked} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Initiative">
                  <select className="input" value={f.areaId ?? ''} onChange={(e) => setF((x) => ({ ...x, areaId: e.target.value || undefined, campaignId: undefined }))}>
                    <option value="">Choose…</option>
                    {db.areas.filter((a) => a.kind !== 'system').map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Campaign">
                  <select
                    className="input"
                    value={f.campaignId ?? ''}
                    onChange={(e) => {
                      const c = db.campaigns.find((x) => x.id === e.target.value)
                      setF((x) => ({ ...x, campaignId: e.target.value || undefined, areaId: c?.areaId ?? x.areaId }))
                    }}
                  >
                    <option value="">No campaign</option>
                    {db.campaigns.filter((c) => !f.areaId || c.areaId === f.areaId).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Platform">
                  <select className="input" value={f.channel ?? ''} onChange={(e) => set('channel', (e.target.value || undefined) as Channel | undefined)} disabled={locked}>
                    <option value="">Choose…</option>
                    {CONTENT_PLATFORMS.map((c) => (
                      <option key={c} value={c}>
                        {CHANNEL_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Content type">
                  <select className="input" value={f.kind ?? 'post'} onChange={(e) => set('kind', e.target.value as ContentItem['kind'])} disabled={locked}>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Planned publishing date" hint="Internal plan, not a schedule.">
                  <input type="date" className="input" value={f.publishDate ?? ''} onChange={(e) => set('publishDate', e.target.value || undefined)} />
                </Field>
                <Field label="Responsible">
                  <input className="input" value={AGENT_NAMES[f.owner ?? ''] ?? f.owner ?? ''} onChange={(e) => set('owner', e.target.value)} />
                </Field>
              </div>
              <Field label="Intended audience">
                <input className="input" value={f.audience ?? ''} onChange={(e) => set('audience', e.target.value)} placeholder={campaign?.audience} />
              </Field>
              {isEmail && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Subject line">
                    <input className="input" value={f.subject ?? ''} onChange={(e) => set('subject', e.target.value)} disabled={locked} />
                  </Field>
                  <Field label="Preview text">
                    <input className="input" value={f.previewText ?? ''} onChange={(e) => set('previewText', e.target.value)} disabled={locked} />
                  </Field>
                  <Field label="Audience or list">
                    <input className="input" value={f.listRef ?? ''} onChange={(e) => set('listRef', e.target.value)} placeholder="e.g. Summit interest list" />
                  </Field>
                </div>
              )}
              <Field label={isEmail ? 'Email body' : f.channel === 'tiktok' || f.channel === 'youtube' || f.channel === 'youtube_shorts' ? 'Script / caption' : 'Copy'}>
                <textarea className="input min-h-56 leading-relaxed" value={f.body ?? ''} onChange={(e) => set('body', e.target.value)} disabled={locked} />
                <span className="mt-1 block text-right text-[11px] text-muted">{(f.body ?? '').length} characters</span>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Call to action">
                  <input className="input" list="cta-options" value={f.cta ?? ''} onChange={(e) => set('cta', e.target.value)} disabled={locked} />
                  <datalist id="cta-options">
                    {[campaign?.cta, ...(brand?.approvedCtas ?? [])].filter(Boolean).map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Hashtags" hint="Separate with spaces or commas.">
                  <input
                    className="input"
                    value={(f.hashtags ?? []).map((h) => `#${h}`).join(' ')}
                    onChange={(e) => set('hashtags', e.target.value.split(/[\s,]+/).map((h) => h.replace(/^#+/, '')).filter(Boolean))}
                    disabled={locked}
                  />
                </Field>
              </div>
              <MediaEditor media={f.media ?? []} onChange={(m) => set('media', m)} disabled={locked} />
            </div>
          </Panel>

          {item && (item.status === 'approved' || item.status === 'scheduled' || item.status === 'published') && (
            <PublishingPanel item={item} busy={busy} onRecord={(to, publishing) => move(to, { publishing })} />
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Save & approval">
            <div className="flex flex-col gap-2">
              <button className="btn-primary justify-center" disabled={busy || (!dirty && !!item) || !actor.canEdit} onClick={onSave}>
                {busy && <Loader2 size={14} className="animate-spin" />} Save changes
              </button>
              {transitions.map((t) => (
                <button
                  key={t.to}
                  className={cn('justify-center', t.to === 'approved' ? 'btn-gold' : 'btn-ghost')}
                  disabled={busy || !actor.canEdit}
                  onClick={() => (t.needsReason ? setReasonFor(t.to) : move(t.to))}
                >
                  {t.label}
                  {dirty && (t.to === 'needs_review' || t.to === 'approved') ? ' (saves first)' : ''}
                </button>
              ))}
              {status === 'needs_review' && !actor.canApprove && (
                <p className="text-xs text-muted">{actor.roleError ? 'Approving is off until approval roles are set up.' : 'Only an owner or approver can approve or request changes.'}</p>
              )}
              {reasonFor && (
                <div className="space-y-2 rounded-xl border border-line p-3">
                  <Field label="What should change?">
                    <textarea autoFocus className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                  <div className="flex gap-2">
                    <button className="btn-primary py-1.5 text-xs" disabled={busy} onClick={() => move(reasonFor, { reason })}>
                      Send back for changes
                    </button>
                    <button className="btn-ghost py-1.5 text-xs" onClick={() => setReasonFor(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            {item && (
              <dl className="mt-4 space-y-1 border-t border-line pt-3 text-xs">
                <div className="flex gap-2">
                  <dt className="w-24 text-muted">Version</dt>
                  <dd className="text-mist">{item.version ?? 1}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 text-muted">Last updated</dt>
                  <dd className="text-mist">
                    {new Date(item.updatedAt).toLocaleString()}
                    {item.updatedBy && ` by ${item.updatedBy}`}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 text-muted">Drafted by</dt>
                  <dd className="text-mist">
                    {item.createdByAgent ? AGENT_NAMES[item.createdByAgent] ?? item.createdByAgent : 'A person'}
                    {item.engine === 'ai' ? ' (AI)' : item.engine === 'builtin' ? ' (template)' : ''}
                  </dd>
                </div>
                {item.approvedBy && (
                  <div className="flex gap-2">
                    <dt className="w-24 text-muted">Approved</dt>
                    <dd className="text-emerald-300">
                      {item.approvedBy}, {item.approvedAt && new Date(item.approvedAt).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {item && (
              <button className="btn-ghost mt-3 w-full justify-center text-xs" onClick={() => setHistoryOpen(true)}>
                <History size={13} /> Revision history
              </button>
            )}
          </Panel>

          <Panel title="Campaign context">
            {campaign ? (
              <dl className="space-y-1 text-xs">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Campaign</dt>
                  <dd>
                    <CampaignLink id={campaign.id} />
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Objective</dt>
                  <dd className="text-mist">{objectiveLabel(campaign.objective)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Audience</dt>
                  <dd className={campaign.audience ? 'text-mist' : 'text-amber-300'}>{campaign.audience || 'Not set'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">CTA</dt>
                  <dd className={campaign.cta ? 'text-mist' : 'text-amber-300'}>{campaign.cta || 'Not set'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-muted">Not part of a campaign.</p>
            )}
            {(guidance || ownGuidance) && (
              <div className="mt-3 border-t border-line pt-3 text-xs">
                <p className="label mb-1">{f.channel && CHANNEL_LABEL[f.channel]} guidance</p>
                {ownGuidance && <p className="mb-1 text-mist">{ownGuidance}</p>}
                {guidance && <p className="text-muted">{guidance}</p>}
              </div>
            )}
            {brand?.tone && <p className="mt-2 text-xs text-muted">Voice: {brand.tone}</p>}
            {brand?.restrictions && <p className="mt-1 text-xs text-amber-200/90">Avoid: {brand.restrictions}</p>}
            {area && brandGaps.length > 0 && (
              <div className="mt-3">
                <SetupList what={`${area.name} brand settings`} items={brandGaps} />
                <Link to={`/areas/${area.slug}?tab=brand`} className="mt-1 inline-block text-xs text-glow hover:underline">
                  Complete them →
                </Link>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {item && <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} item={item} />}
      <Modal open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} title="Unsaved changes">
        <p className="text-sm text-mist">You have changes that aren’t saved. Leave without saving?</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => blocker.reset?.()}>
            Stay
          </button>
          <button className="btn-primary" onClick={() => blocker.proceed?.()}>
            Leave without saving
          </button>
        </div>
      </Modal>
    </div>
  )
}

function MediaEditor({ media, onChange, disabled }: { media: MediaRef[]; onChange: (m: MediaRef[]) => void; disabled?: boolean }) {
  const upd = (i: number, patch: Partial<MediaRef>) => onChange(media.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">Media</p>
      {media.length === 0 && <p className="text-xs text-muted">No media attached. Add a link to the image or video (Canva, Google Drive, Dropbox…).</p>}
      <ul className="space-y-2">
        {media.map((m, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
            <input className="input py-1.5 text-xs" placeholder="Label (e.g. Speaker photo)" value={m.label} onChange={(e) => upd(i, { label: e.target.value })} disabled={disabled} aria-label="Media label" />
            <input className="input py-1.5 text-xs" placeholder="https://…" value={m.url ?? ''} onChange={(e) => upd(i, { url: e.target.value })} disabled={disabled} aria-label="Media link" />
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => onChange(media.filter((_, j) => j !== i))} disabled={disabled} aria-label="Remove media">
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
      <button className="btn-ghost mt-2 py-1 text-xs" onClick={() => onChange([...media, { label: '' }])} disabled={disabled}>
        <Plus size={12} /> Add media link
      </button>
      <p className="mt-1 text-[11px] text-muted">File uploads aren’t connected yet; EMS stores links to where the media lives.</p>
    </div>
  )
}

/** Recording what actually happened on the platform. Nothing here posts anything. */
function PublishingPanel({ item, busy, onRecord }: { item: ContentItem; busy: boolean; onRecord: (to: ContentStatus, p: ContentItem['publishing']) => void }) {
  const db = useDB()
  const brand = db.brandSettings.find((b) => b.areaId === item.areaId)
  const dest = publishingDestination(item.channel, brand)
  const [copied, setCopied] = useState(false)
  const [sched, setSched] = useState({ via: dest.label === 'the platform' || dest.label === 'your email platform' ? '' : dest.label, scheduledFor: item.publishDate ?? '', externalRef: '' })
  const [pub, setPub] = useState({ publishedAt: item.publishing?.scheduledFor ?? item.publishDate ?? '', url: '' })
  const text = [item.channel === 'email' && item.subject ? `Subject: ${item.subject}` : '', item.channel === 'email' && item.previewText ? `Preview: ${item.previewText}` : '', item.body ?? '', item.cta ? `\n${item.cta}` : '', item.hashtags?.length ? `\n${item.hashtags.map((h) => `#${h}`).join(' ')}` : '']
    .filter(Boolean)
    .join('\n')
  const p = item.publishing

  return (
    <Panel title="Publishing" hint="Approval is internal. Schedule or post on the platform yourself, then record it here.">
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-ghost py-1.5 text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch {
              // Clipboard blocked; the text is selectable in the editor.
            }
          }}
        >
          <Copy size={12} /> {copied ? 'Copied' : 'Copy approved copy'}
        </button>
        {dest.url ? (
          <a className="btn-ghost py-1.5 text-xs" href={dest.url} target="_blank" rel="noreferrer">
            <ExternalLink size={12} /> Open {dest.label}
          </a>
        ) : (
          <span className="text-xs text-muted">{item.channel === 'email' ? 'Add your email platform’s link in the initiative’s brand settings (Email guidance).' : ''}</span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">Opening {dest.label} or copying text doesn’t schedule anything. Direct posting to Meta, TikTok, YouTube or email isn’t connected.</p>

      {p && (p.scheduledRecordedAt || p.publishedRecordedAt) && (
        <dl className="mt-4 space-y-1 rounded-xl border border-line p-3 text-xs">
          {p.scheduledRecordedAt && (
            <div>
              <dt className="inline text-muted">Scheduled: </dt>
              <dd className="inline text-mist">
                {p.via} for {p.scheduledFor && friendlyDate(p.scheduledFor)}
                {p.externalRef && ` · ref ${p.externalRef}`} · recorded by {p.scheduledRecordedBy}
              </dd>
            </div>
          )}
          {p.publishedRecordedAt && (
            <div>
              <dt className="inline text-muted">Published: </dt>
              <dd className="inline text-mist">
                {p.publishedAt && friendlyDate(p.publishedAt)}
                {p.url && (
                  <>
                    {' · '}
                    <a className="text-glow hover:underline" href={p.url} target="_blank" rel="noreferrer">
                      view post
                    </a>
                  </>
                )}{' '}
                · recorded by {p.publishedRecordedBy}
              </dd>
            </div>
          )}
        </dl>
      )}

      {item.status === 'approved' && (
        <form
          className="mt-4 grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            onRecord('scheduled', { via: sched.via, scheduledFor: sched.scheduledFor, externalRef: sched.externalRef })
          }}
        >
          <p className="text-xs font-medium text-white sm:col-span-3">I scheduled it on the platform</p>
          <Field label="Where">
            <input className="input py-1.5 text-xs" value={sched.via} onChange={(e) => setSched({ ...sched, via: e.target.value })} required placeholder="Meta Business Suite" />
          </Field>
          <Field label="Scheduled for">
            <input type="date" className="input py-1.5 text-xs" value={sched.scheduledFor} onChange={(e) => setSched({ ...sched, scheduledFor: e.target.value })} required />
          </Field>
          <Field label="Reference (optional)">
            <input className="input py-1.5 text-xs" value={sched.externalRef} onChange={(e) => setSched({ ...sched, externalRef: e.target.value })} placeholder="Post ID or note" />
          </Field>
          <button className="btn-ghost py-1.5 text-xs sm:col-span-3" disabled={busy}>
            Record as scheduled
          </button>
        </form>
      )}
      {(item.status === 'approved' || item.status === 'scheduled') && (
        <form
          className="mt-3 grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            onRecord('published', { via: p?.via ?? sched.via, publishedAt: pub.publishedAt, url: pub.url })
          }}
        >
          <p className="text-xs font-medium text-white sm:col-span-3">It’s live — I checked</p>
          <Field label="Published on">
            <input type="date" className="input py-1.5 text-xs" value={pub.publishedAt} onChange={(e) => setPub({ ...pub, publishedAt: e.target.value })} required />
          </Field>
          <Field label="Link to the post (optional)">
            <input className="input py-1.5 text-xs sm:col-span-2" value={pub.url} onChange={(e) => setPub({ ...pub, url: e.target.value })} placeholder="https://…" />
          </Field>
          <button className="btn-ghost self-end py-1.5 text-xs" disabled={busy}>
            Record as published
          </button>
        </form>
      )}
      {item.status === 'published' && item.campaignId && (
        <Link to={`/studio/campaigns/${item.campaignId}#results`} className="mt-3 inline-block text-xs text-glow hover:underline">
          Enter results for this campaign →
        </Link>
      )}
    </Panel>
  )
}

function HistoryModal({ open, onClose, item }: { open: boolean; onClose: () => void; item: ContentItem }) {
  const db = useDB()
  const revisions = db.contentRevisions.filter((r) => r.contentId === item.id).sort((a, b) => b.version - a.version)
  const events = db.contentEvents.filter((e) => e.contentId === item.id)
  const [view, setView] = useState<string | null>(null)
  const shown = revisions.find((r) => r.id === view)
  const timeline = [
    ...events.map((e) => ({ at: e.createdAt, text: `${CONTENT_STATUS_LABEL[e.from]} → ${CONTENT_STATUS_LABEL[e.to]}`, by: e.by, note: e.reason, rev: undefined as string | undefined })),
    ...revisions.map((r) => ({ at: r.createdAt, text: `Edited (version ${r.version} → ${r.version + 1})`, by: r.changedBy, note: r.note, rev: r.id })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <Modal open={open} onClose={onClose} title="Revision history" wide>
      {timeline.length ? (
        <ul className="space-y-2">
          {timeline.map((t, i) => (
            <li key={i} className="flex flex-wrap items-start gap-2 text-sm">
              <span className="w-36 shrink-0 text-xs text-muted">{new Date(t.at).toLocaleString()}</span>
              <span className="flex-1 text-white">
                {t.text}
                <span className="block text-xs text-muted">
                  {t.by}
                  {t.note && ` · ${t.note}`}
                </span>
              </span>
              {t.rev && (
                <button className="btn-ghost py-1 text-xs" onClick={() => setView(view === t.rev ? null : t.rev!)}>
                  {view === t.rev ? 'Hide' : 'View previous version'}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No changes recorded yet.</p>
      )}
      {shown && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="label mb-1">Version {shown.version} (before)</p>
            <p className="text-sm font-medium text-white">{shown.snapshot.title}</p>
            <pre className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-950/50 p-3 font-sans text-xs text-mist">{shown.snapshot.body || '(empty)'}</pre>
            {shown.snapshot.cta && <p className="mt-1 text-xs text-muted">CTA: {shown.snapshot.cta}</p>}
          </div>
          <div>
            <p className="label mb-1">Current (version {item.version ?? 1})</p>
            <p className="text-sm font-medium text-white">{item.title}</p>
            <pre className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-950/50 p-3 font-sans text-xs text-mist">{item.body || '(empty)'}</pre>
            {item.cta && <p className="mt-1 text-xs text-muted">CTA: {item.cta}</p>}
          </div>
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <button className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
