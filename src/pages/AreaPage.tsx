import { Check, Plus, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { isOpen, needsAttention } from '../ai/intelligence'
import { useDB, useEMS } from '../app/EMSContext'
import { useUI } from '../app/UIContext'
import { MoveAreaForward } from '../components/MoveForward'
import { ProjectCard } from '../components/ProjectCard'
import { Calm, ModeBadge, PageHeader, Panel, Progress } from '../components/ui'
import { CADENCE_LABEL, CERTAINTY_LABEL, CHANNEL_LABEL, VERDICT_LABEL } from '../domain/labels'
import { cn, daysSince, money } from '../lib/util'

export default function AreaPage() {
  const { slug } = useParams()
  const db = useDB()
  const { store } = useEMS()
  const ui = useUI()
  const [params, setParams] = useSearchParams()
  const area = db.areas.find((a) => a.slug === slug)
  const [editingState, setEditingState] = useState(false)
  const [stateText, setStateText] = useState('')
  const [newLearningArea, setNewLearningArea] = useState('')
  const moving = params.get('move') === '1'

  const data = useMemo(() => {
    if (!area) return null
    const projects = db.projects.filter((p) => p.areaId === area.id)
    return {
      open: projects.filter(isOpen).sort((a, b) => b.progress - a.progress),
      finished: projects.filter((p) => !isOpen(p)),
      attention: needsAttention(db).filter((n) => projects.some((p) => p.id === n.key) || db.ongoing.some((o) => o.id === n.key && o.areaId === area.id)),
      ongoing: db.ongoing.filter((o) => o.areaId === area.id),
      goals: db.goals.filter((g) => g.areaId === area.id),
      campaigns: db.campaigns.filter((c) => c.areaId === area.id),
      income: db.income.filter((i) => i.areaId === area.id),
      ideas: db.ideas.filter((i) => i.areaId === area.id && i.status !== 'let_go' && i.status !== 'became_project'),
      waiting: db.tasks.filter((t) => t.areaId === area.id && t.status === 'waiting'),
      assets: db.assets.filter((a) => a.areaId === area.id),
      learningAreas: db.learningAreas.filter((l) => l.areaId === area.id),
    }
  }, [db, area])

  if (!area || !data) return <Calm>That area does not exist.</Calm>

  const actual = data.income.filter((i) => i.certainty === 'actual').reduce((s, i) => s + i.amount, 0)
  const pending = data.income.filter((i) => i.certainty !== 'actual').reduce((s, i) => s + i.amount, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={area.kind === 'standalone' ? 'Standalone' : area.kind === 'organization' ? 'Organization' : area.kind === 'personal' ? 'Personal' : area.kind === 'school' ? 'School' : 'Area'}
        title={area.name}
        sub={area.tagline}
        actions={
          <>
            <button className="btn-ghost" onClick={() => ui.openNewProject({ areaId: area.id })}>
              <Plus size={15} /> New project
            </button>
            <button className="btn-primary" onClick={() => setParams(moving ? {} : { move: '1' })}>
              <Wand2 size={15} /> {moving ? 'Hide' : 'Move this forward'}
            </button>
          </>
        }
      />

      {moving && (
        <Panel title="Move this forward">
          <MoveAreaForward areaId={area.id} />
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Panel
            title="Current state"
            action={
              <button
                className="text-xs text-muted hover:text-white"
                onClick={() => {
                  if (editingState) store.update('areas', area.id, { currentState: stateText })
                  else setStateText(area.currentState ?? '')
                  setEditingState(!editingState)
                }}
              >
                {editingState ? 'Save' : 'Edit'}
              </button>
            }
          >
            {editingState ? (
              <textarea className="input" rows={3} value={stateText} onChange={(e) => setStateText(e.target.value)} placeholder="Where things stand, in your words." />
            ) : (
              <p className="text-sm text-mist">
                {area.currentState ||
                  `${data.open.length} open project${data.open.length === 1 ? '' : 's'}${data.attention.length ? `, ${data.attention.length} needing attention` : ', nothing stalled'}${data.ongoing.length ? `, ${data.ongoing.length} ongoing rhythm${data.ongoing.length === 1 ? '' : 's'}` : ''}.`}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {area.focuses.map((f) => (
                <span key={f} className="chip">
                  {f}
                </span>
              ))}
            </div>
          </Panel>

          {data.attention.length > 0 && (
            <Panel title="What is not moving">
              <ul className="-mx-3">
                {data.attention.map((a) => (
                  <li key={a.key}>
                    <Link to={a.href} className="row">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                      <div>
                        <p className="text-sm text-white">{a.title}</p>
                        <p className="text-xs text-muted">{a.why}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Projects" action={<button className="text-xs text-muted hover:text-white" onClick={() => ui.openNewProject({ areaId: area.id })}>+ New project</button>}>
            {data.open.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {data.open.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            ) : (
              <Calm>No open projects here. That can be exactly right.</Calm>
            )}
            {data.finished.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-muted">Finished and closed ({data.finished.length})</summary>
                <ul className="mt-2 space-y-1">
                  {data.finished.map((p) => (
                    <li key={p.id}>
                      <Link to={`/projects/${p.id}`} className="text-sm text-muted hover:text-white">
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Panel>

          {data.ongoing.length > 0 && (
            <Panel title="Ongoing work" hint="Rhythms that repeat. They never “complete”.">
              <ul className="-mx-3">
                {data.ongoing.map((o) => (
                  <li key={o.id} className="row items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{o.title}</p>
                      <p className="text-xs text-muted">
                        {CADENCE_LABEL[o.cadence]} · {o.lastDoneAt ? `last done ${daysSince(o.lastDoneAt)} day${daysSince(o.lastDoneAt) === 1 ? '' : 's'} ago` : 'not started'}
                      </p>
                    </div>
                    <ModeBadge mode={o.mode} />
                    <button
                      className="btn-ghost py-1 text-xs"
                      onClick={() => store.update('ongoing', o.id, { lastDoneAt: new Date().toISOString() })}
                      aria-label={`Mark ${o.title} done for now`}
                    >
                      <Check size={13} /> Done
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {data.campaigns.length > 0 && (
            <Panel title="Campaigns">
              <ul className="space-y-3">
                {data.campaigns.map((c) => (
                  <li key={c.id} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="mr-auto text-sm font-medium text-white">{c.name}</p>
                      <span className="chip">{c.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Goal: {c.objective} · {c.channels.map((ch) => CHANNEL_LABEL[ch]).join(', ')}
                    </p>
                    {c.message && <p className="mt-2 text-sm italic text-mist">“{c.message}”</p>}
                    {c.metrics && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                        {Object.entries(c.metrics).map(([k, v]) => (
                          <span key={k}>
                            {k.replace(/([A-Z])/g, ' $1').toLowerCase()}: <span className="text-white">{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {c.projectId && (
                      <Link to={`/projects/${c.projectId}?move=1`} className="mt-2 inline-block text-xs text-glow hover:underline">
                        Move this campaign forward →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          {area.slug === 'dbm' && (
            <Panel title="Learning areas" hint="DBM has five. Only you define them.">
              <ul className="space-y-1.5">
                {data.learningAreas.map((l) => (
                  <li key={l.id} className="text-sm text-white">
                    {l.name}
                  </li>
                ))}
              </ul>
              {data.learningAreas.length < 5 && (
                <>
                  <p className="mt-2 text-xs text-muted">
                    {5 - data.learningAreas.length} more to add when you are ready. I won’t guess them.
                  </p>
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!newLearningArea.trim()) return
                      store.create('learningAreas', { areaId: area.id, name: newLearningArea.trim() })
                      setNewLearningArea('')
                    }}
                  >
                    <input className="input py-1.5 text-xs" value={newLearningArea} onChange={(e) => setNewLearningArea(e.target.value)} placeholder="Learning area name" />
                    <button className="btn-ghost py-1 text-xs">Add</button>
                  </form>
                </>
              )}
            </Panel>
          )}

          {data.goals.length > 0 && (
            <Panel title="Goals">
              <ul className="space-y-3">
                {data.goals.map((g) => (
                  <li key={g.id}>
                    <p className="text-sm text-white">{g.title}</p>
                    {g.targetValue ? (
                      <>
                        <Progress value={((g.current ?? 0) / g.targetValue) * 100} className="mt-1.5" />
                        <p className="mt-1 text-xs text-muted">
                          {g.current ?? 0} of {g.targetValue} {g.metric?.toLowerCase()}
                        </p>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Income">
            {data.income.length ? (
              <>
                <p className="display text-3xl text-gold">{money(actual)}</p>
                <p className="text-xs text-muted">Received · plus {money(pending)} expected, forecast or estimated (not guaranteed)</p>
                <ul className="mt-3 space-y-1.5">
                  {data.income.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 text-xs">
                      <span className="text-mist">{i.label}</span>
                      <span className={cn('shrink-0', i.certainty === 'actual' ? 'text-gold' : 'text-muted')}>
                        {money(i.amount)} · {CERTAINTY_LABEL[i.certainty]}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Calm>No income tracked here yet.</Calm>
            )}
          </Panel>

          {data.waiting.length > 0 && (
            <Panel title="Waiting on">
              <ul className="space-y-2 text-sm">
                {data.waiting.map((t) => (
                  <li key={t.id}>
                    <p className="text-white">{t.title}</p>
                    <p className="text-xs text-muted">{t.waitingOn}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Ideas & opportunities" action={<Link to="/ideas" className="text-xs text-muted hover:text-white">All →</Link>}>
            {data.ideas.length ? (
              <ul className="space-y-2">
                {data.ideas.map((i) => (
                  <li key={i.id} className="text-sm">
                    <p className="text-white">{i.title}</p>
                    {i.verdict && <p className="text-xs text-muted">{VERDICT_LABEL[i.verdict]}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <Calm>No open ideas here.</Calm>
            )}
          </Panel>

          {data.assets.length > 0 && (
            <Panel title="What you already have">
              <ul className="space-y-1.5 text-sm">
                {data.assets.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span className="text-white">{a.title}</span>
                    <span className="text-xs text-muted">{a.status.replace('_', ' ')}</span>
                  </li>
                ))}
              </ul>
              <Link to={`/information?q=${encodeURIComponent(area.name)}`} className="mt-3 inline-block text-xs text-glow hover:underline">
                See everything connected →
              </Link>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
