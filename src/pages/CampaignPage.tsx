import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { draftForCampaign, planCampaignTasks, type ProposedTask } from '../ai/campaignAI'
import { runSkill } from '../ai/skills'
import { useDB, useEMS } from '../app/EMSContext'
import { ActionCard } from '../components/ActionCard'
import { AGENT_NAMES, CAMPAIGN_STATUS_LABEL, CampaignForm, ContentStatusBadge, SetupList, StudioSetupNotice, useActor } from '../components/studio'
import { AreaTag, Calm, DemoTag, Field, Modal, Panel } from '../components/ui'
import { recordMetric } from '../data/contentOps'
import { METRICS, missingBrandConfig, missingCampaignConfig, objectiveLabel, overdueReason, summarizeMetrics } from '../domain/content'
import { CHANNEL_LABEL } from '../domain/labels'
import type { CampaignStatus, Channel } from '../domain/types'
import { cn, friendlyDate, money, nowIso, toDateKey } from '../lib/util'

export default function CampaignPage() {
  const { id } = useParams()
  const db = useDB()
  const { store, ai } = useEMS()
  const actor = useActor()
  const c = db.campaigns.find((x) => x.id === id)
  const [editing, setEditing] = useState(false)
  const [drafting, setDrafting] = useState<string | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [planning, setPlanning] = useState<ProposedTask[] | null>(null)
  const [strategyId, setStrategyId] = useState<string | null>(null)
  const [busyStrategy, setBusyStrategy] = useState(false)

  const content = useMemo(() => db.content.filter((x) => x.campaignId === id).sort((a, b) => (a.publishDate ?? '9').localeCompare(b.publishDate ?? '9')), [db, id])
  if (!c) return <Calm>That campaign doesn’t exist. It may have been removed.</Calm>

  const area = db.areas.find((a) => a.id === c.areaId)
  const brand = db.brandSettings.find((b) => b.areaId === c.areaId)
  const gaps = missingCampaignConfig(c)
  const brandGaps = area ? missingBrandConfig(area, brand) : []
  const project = c.projectId ? db.projects.find((p) => p.id === c.projectId) : undefined
  const strategy = strategyId ? db.actions.find((a) => a.id === strategyId) : db.actions.filter((a) => a.campaignId === c.id && a.skill === 'campaign_strategy' && a.state !== 'declined').at(-1)

  const draft = async (ch: Channel) => {
    setDrafting(ch)
    try {
      const { item, note } = await draftForCampaign(store, ai, c.id, ch, actor.name)
      setNote({ ok: true, text: `Created “${item.title}” as a draft. ${note}` })
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Could not create the draft.' })
    }
    setDrafting(null)
  }

  return (
    <div className="space-y-5">
      <div className="rise">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Link to="/studio?tab=campaigns" className="text-muted hover:text-white">
            ← Campaigns
          </Link>
          <AreaTag area={area} />
          <DemoTag show={c.demo} />
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="display text-3xl sm:text-4xl">{c.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {objectiveLabel(c.objective)}
              {c.owner && ` · Owner: ${c.owner}`}
              {(c.startDate || c.endDate) && ` · ${c.startDate ? friendlyDate(c.startDate) : '…'} – ${c.endDate ? friendlyDate(c.endDate) : '…'}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="input w-auto py-1.5 text-xs" value={c.status} onChange={(e) => store.update('campaigns', c.id, { status: e.target.value as CampaignStatus })} aria-label="Campaign status">
              {Object.entries(CAMPAIGN_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="btn-ghost" onClick={() => setEditing(true)}>
              Edit campaign
            </button>
            <Link to={`/studio/content/new?campaign=${c.id}`} className="btn-primary">
              <Plus size={15} /> New draft
            </Link>
          </div>
        </div>
      </div>
      <StudioSetupNotice />
      {gaps.length > 0 && <SetupList what="This campaign" items={gaps} />}
      {brandGaps.length > 0 && area && (
        <div className="rounded-xl border border-line px-3 py-2.5 text-xs text-muted">
          {area.name} brand settings are incomplete ({brandGaps.join(', ')}). Assistants will mark anything that depends on them as needing confirmation.{' '}
          <Link to={`/areas/${area.slug}?tab=brand`} className="text-glow hover:underline">
            Complete them
          </Link>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel title={`Content · ${content.length}`} hint="Every piece must be approved before it goes anywhere. Approving does not post it.">
            {content.length ? (
              <ul className="-mx-3">
                {content.map((x) => (
                  <li key={x.id}>
                    <Link to={`/studio/content/${x.id}`} className="row">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{x.title || 'Untitled'}</p>
                        <p className="truncate text-xs text-muted">
                          {x.channel ? CHANNEL_LABEL[x.channel] : 'No platform'} · {x.publishDate ? friendlyDate(x.publishDate) : 'No planned date'} · {AGENT_NAMES[x.owner ?? ''] ?? x.owner ?? 'Unassigned'}
                          {x.engine === 'builtin' && ' · template'}
                          {x.engine === 'ai' && ' · AI draft'}
                        </p>
                        {overdueReason(x) && <p className="text-xs text-rose-300">{overdueReason(x)}</p>}
                      </div>
                      <ContentStatusBadge status={x.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Calm>No content yet. Draft one per platform below, or start one yourself.</Calm>
            )}
            <div className="mt-4 border-t border-line pt-4">
              <p className="label mb-2">Draft with your assistants</p>
              <p className="mb-2 text-xs text-muted">
                {ai.connected ? 'Social Media Assistant writes posts; Marketing Assistant writes email. Each is shaped for its platform and saved as a draft.' : 'No AI model is connected, so this creates a platform-shaped template with the gaps marked.'}
              </p>
              {c.channels.length ? (
                <div className="flex flex-wrap gap-2">
                  {c.channels.map((ch) => (
                    <button key={ch} className="btn-ghost py-1.5 text-xs" disabled={!!drafting || !actor.canEdit} onClick={() => draft(ch)}>
                      {drafting === ch ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {CHANNEL_LABEL[ch]}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-200">Add platforms to this campaign first.</p>
              )}
              {note && (
                <p role="status" className={cn('mt-2 text-xs', note.ok ? 'text-emerald-300' : 'text-amber-200')}>
                  {note.text}
                </p>
              )}
            </div>
          </Panel>

          <Results campaignId={c.id} />
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Campaign">
            <dl className="space-y-1.5 text-xs">
              {(
                [
                  ['Objective', objectiveLabel(c.objective)],
                  ['Audience', c.audience],
                  ['Call to action', c.cta],
                  ['Platforms', c.channels.map((ch) => CHANNEL_LABEL[ch]).join(', ')],
                  ['Success measures', (c.successMetrics ?? []).map((m) => METRICS[m]?.label ?? m).join(', ')],
                  ['Description', c.description],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted">{k}</dt>
                  <dd className={v ? 'text-mist' : 'text-amber-300'}>{v || 'Not set'}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Plan the work" hint="Project Assistant turns this campaign into tasks with dates.">
            {project ? (
              <p className="mb-2 text-xs text-muted">
                Linked project:{' '}
                <Link className="text-glow hover:underline" to={`/projects/${project.id}`}>
                  {project.name}
                </Link>
              </p>
            ) : null}
            <button className="btn-ghost w-full justify-center text-xs" disabled={!actor.canEdit} onClick={() => setPlanning(planCampaignTasks(db, c))}>
              Turn into tasks…
            </button>
          </Panel>

          <Panel title="Strategy review" hint="Marketing Assistant reviews audience, message, offer and call to action.">
            {strategy ? <ActionCard action={strategy} /> : <Calm>No review yet.</Calm>}
            <button
              className="btn-ghost mt-3 w-full justify-center text-xs"
              disabled={busyStrategy || !actor.canEdit}
              onClick={async () => {
                setBusyStrategy(true)
                const a = await runSkill(store, ai, { skill: 'campaign_strategy', agentKey: 'marketing', title: `Strategy review: ${c.name}`, projectId: c.projectId, areaId: c.areaId, campaignId: c.id })
                setStrategyId(a.id)
                setBusyStrategy(false)
              }}
            >
              {busyStrategy && <Loader2 size={12} className="animate-spin" />} {strategy ? 'Review again' : 'Review strategy'}
            </button>
          </Panel>
        </div>
      </div>

      <CampaignForm
        open={editing}
        title="Edit campaign"
        initial={c}
        onClose={() => setEditing(false)}
        onSave={(next) => {
          store.update('campaigns', c.id, next)
          setEditing(false)
        }}
      />
      <TaskPlanModal campaignId={c.id} tasks={planning} onClose={() => setPlanning(null)} />
    </div>
  )
}

function TaskPlanModal({ campaignId, tasks, onClose }: { campaignId: string; tasks: ProposedTask[] | null; onClose: () => void }) {
  const db = useDB()
  const { store } = useEMS()
  const [picked, setPicked] = useState<Set<number> | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const c = db.campaigns.find((x) => x.id === campaignId)!
  const sel = picked ?? new Set((tasks ?? []).map((_, i) => i))
  const close = () => {
    setPicked(null)
    setDone(null)
    onClose()
  }
  return (
    <Modal open={!!tasks} onClose={close} title="Turn campaign into tasks">
      {done ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-200" role="status">
            {done}
          </p>
          <Link to={`/projects/${c.projectId}`} className="btn-primary" onClick={close}>
            Open the project
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">Choose what to add. They go into {c.projectId ? 'the linked project' : `a new project “${c.name}”`} as your to-dos.</p>
          <ul className="space-y-2">
            {(tasks ?? []).map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#8b7cff]"
                  checked={sel.has(i)}
                  onChange={() => {
                    const n = new Set(sel)
                    if (n.has(i)) n.delete(i)
                    else n.add(i)
                    setPicked(n)
                  }}
                  aria-label={t.title}
                />
                <span className="flex-1 text-white">
                  {t.title}
                  <span className="block text-xs text-muted">
                    {t.dueDate ? friendlyDate(t.dueDate) : 'No date'}
                    {t.milestone && ' · milestone'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost" onClick={close}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!sel.size}
              onClick={() => {
                let projectId = c.projectId
                if (!projectId) {
                  const p = store.create('projects', { name: c.name, outcome: objectiveLabel(c.objective), areaId: c.areaId, status: 'active', cadence: 'none', dueDate: c.endDate, progress: 0, lastActivityAt: nowIso() })
                  projectId = p.id
                  store.update('campaigns', c.id, { projectId })
                }
                const chosen = (tasks ?? []).filter((_, i) => sel.has(i))
                for (const t of chosen) {
                  if (t.milestone) store.create('milestones', { projectId, title: t.title, dueDate: t.dueDate, done: false })
                  else store.create('tasks', { title: t.title, status: 'todo', mode: 'me', projectId, areaId: c.areaId, dueDate: t.dueDate, importance: 3, source: 'assistant' })
                }
                setDone(`Added ${chosen.filter((t) => !t.milestone).length} tasks and ${chosen.filter((t) => t.milestone).length} milestones.`)
              }}
            >
              Add {sel.size} to the project
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

function Results({ campaignId }: { campaignId: string }) {
  const db = useDB()
  const { store } = useEMS()
  const actor = useActor()
  const c = db.campaigns.find((x) => x.id === campaignId)!
  const rows = db.campaignMetrics.filter((m) => m.campaignId === campaignId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const summary = summarizeMetrics(c, db.campaignMetrics)
  const [form, setForm] = useState({ metric: summary[0]?.metric ?? 'reach', kind: 'actual' as 'actual' | 'target', value: '', source: '', periodStart: '', periodEnd: toDateKey(new Date()), note: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fmt = (metric: string, v: number | null) => (v === null ? '—' : METRICS[metric]?.money ? money(v) : v.toLocaleString())
  const followUp = ['leads', 'program', 'registrations', 'event'].includes(c.objective)

  return (
    <Panel id="results" title="Results" hint="Enter numbers from each platform’s insights. Actual results and targets are kept separate, and every result needs a source.">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {summary.map((m) => (
          <div key={m.metric} className="rounded-xl bg-white/[0.03] p-2.5">
            <p className="text-[11px] text-muted">{METRICS[m.metric]?.label ?? m.metric}</p>
            <p className="display text-2xl text-white">{fmt(m.metric, m.actual)}</p>
            <p className="text-[10px] text-muted">{m.target !== null ? `Target ${fmt(m.metric, m.target)}` : 'No target set'}</p>
          </div>
        ))}
      </div>
      <form
        className="mt-4 grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault()
          const r = recordMetric(store, {
            campaignId, metric: form.metric, kind: form.kind, value: Number(form.value), source: form.source || undefined,
            periodStart: form.periodStart || undefined, periodEnd: form.periodEnd || undefined, note: form.note || undefined, enteredBy: actor.name,
          })
          if ('error' in r) return setMsg({ ok: false, text: r.error })
          setMsg({ ok: true, text: `Saved ${form.kind === 'target' ? 'target' : 'result'}: ${METRICS[form.metric]?.label ?? form.metric} ${form.value}.` })
          setForm({ ...form, value: '', note: '' })
        }}
      >
        <Field label="Metric">
          <select className="input py-1.5 text-xs" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
            {Object.entries(METRICS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select className="input py-1.5 text-xs" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'actual' | 'target' })}>
            <option value="actual">Actual result</option>
            <option value="target">Target</option>
          </select>
        </Field>
        <Field label="Number">
          <input className="input py-1.5 text-xs" inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
        </Field>
        <Field label={form.kind === 'actual' ? 'Source (required)' : 'Source'}>
          <input className="input py-1.5 text-xs" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Meta insights" />
        </Field>
        <Field label="Period from">
          <input type="date" className="input py-1.5 text-xs" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
        </Field>
        <Field label="Period to">
          <input type="date" className="input py-1.5 text-xs" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
        </Field>
        <div className="flex items-end sm:col-span-6">
          <button className="btn-primary py-1.5 text-xs" disabled={!actor.canEdit}>
            Save
          </button>
          {msg && (
            <p role="status" className={cn('ml-3 text-xs', msg.ok ? 'text-emerald-300' : 'text-amber-200')}>
              {msg.text}
            </p>
          )}
        </div>
      </form>
      {rows.length > 0 && (
        <ul className="mt-3 divide-y divide-line text-xs">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <span className={cn('chip', r.kind === 'target' && 'border-dashed')}>{r.kind === 'target' ? 'Target' : 'Actual'}</span>
              <span className="text-white">
                {METRICS[r.metric]?.label ?? r.metric}: {fmt(r.metric, r.value)}
              </span>
              <span className="text-muted">
                {r.source ?? 'no source'}
                {(r.periodStart || r.periodEnd) && ` · ${r.periodStart ?? '…'} to ${r.periodEnd ?? '…'}`}
                {r.enteredBy && ` · entered by ${r.enteredBy}`}
              </span>
              <button className="ml-auto text-muted hover:text-rose-300" aria-label="Remove this entry" onClick={() => window.confirm('Remove this entry?') && store.remove('campaignMetrics', r.id)}>
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {followUp && (
        <button
          className="btn-ghost mt-3 text-xs"
          onClick={() => {
            store.create('tasks', { title: `Follow up on new inquiries from ${c.name}`, status: 'todo', mode: 'me', projectId: c.projectId, areaId: c.areaId, importance: 4, source: 'manual', dueDate: toDateKey(new Date(Date.now() + 86_400_000)) })
            setMsg({ ok: true, text: 'Added a follow-up to your to-dos for tomorrow.' })
          }}
        >
          + Follow-up task for new inquiries
        </button>
      )}
    </Panel>
  )
}
