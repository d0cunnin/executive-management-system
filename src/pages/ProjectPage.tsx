import { Clock, Flag, Plus, Trash2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { areaOf, isOpen } from '../ai/intelligence'
import { useDB, useEMS } from '../app/EMSContext'
import { ActionCard } from '../components/ActionCard'
import { FinishProject } from '../components/FinishProject'
import { MoveProjectForward } from '../components/MoveForward'
import { AreaTag, Calm, DemoTag, ModeBadge, Panel, Progress } from '../components/ui'
import { CADENCE_LABEL, MODE_LABEL, NEXT_LABEL, STATUS_LABEL } from '../domain/labels'
import type { Cadence, ProjectStatus, Task, WorkMode } from '../domain/types'
import { cn, friendlyDate, money, nowIso } from '../lib/util'

const MODES: WorkMode[] = ['me', 'ai_helps', 'ai_does']

export default function ProjectPage() {
  const { id } = useParams()
  const db = useDB()
  const { store } = useEMS()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [finishing, setFinishing] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [newMode, setNewMode] = useState<WorkMode>('me')
  const [newMs, setNewMs] = useState('')
  const p = db.projects.find((x) => x.id === id)
  if (!p) return <Calm>That project is not here. It may have been removed.</Calm>

  const moving = params.get('move') === '1'
  const tasks = db.tasks.filter((t) => t.projectId === p.id)
  const openTasks = tasks.filter((t) => t.status !== 'done')
  const doneTasks = tasks.filter((t) => t.status === 'done')
  const milestones = db.milestones.filter((m) => m.projectId === p.id).sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'))
  const actions = db.actions.filter((a) => a.projectId === p.id && a.state !== 'declined').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const campaign = db.campaigns.find((c) => c.projectId === p.id)
  const events = db.events.filter((e) => e.projectId === p.id)
  const notes = db.notes.filter((n) => n.projectId === p.id)
  const area = areaOf(db, p.areaId)
  const touch = () => store.update('projects', p.id, { lastActivityAt: nowIso() })

  const setStatus = (status: ProjectStatus) => {
    if (status === 'completed') return setFinishing(true)
    if (p.status === 'paused' && status === 'active') store.logProgress({ kind: 'restarted', title: `Restarted: ${p.name}`, projectId: p.id, areaId: p.areaId })
    store.update('projects', p.id, { status, lastActivityAt: nowIso() })
  }

  const toggleTask = (t: Task) => {
    const done = t.status !== 'done'
    store.update('tasks', t.id, { status: done ? 'done' : 'todo', doneAt: done ? nowIso() : undefined })
    if (done) {
      touch()
      store.logProgress({ kind: 'project_advanced', title: t.title, projectId: p.id, areaId: p.areaId })
    }
  }

  const toggleMilestone = (mid: string, done: boolean) => {
    store.update('milestones', mid, { done, doneAt: done ? nowIso() : undefined })
    const all = milestones.map((m) => (m.id === mid ? { ...m, done } : m))
    store.update('projects', p.id, { progress: Math.round((all.filter((m) => m.done).length / all.length) * 100), lastActivityAt: nowIso() })
    if (done) store.logProgress({ kind: 'milestone', title: `${p.name}: ${milestones.find((m) => m.id === mid)?.title}`, projectId: p.id, areaId: p.areaId })
  }

  return (
    <div className="space-y-5">
      <div className="rise">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <AreaTag area={area} />
          <DemoTag show={p.demo} />
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="display text-3xl sm:text-4xl">{p.name}</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted">{p.outcome}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOpen(p) && (
              <button className="btn-ghost" onClick={() => setFinishing(true)}>
                <Flag size={15} /> Finish this project
              </button>
            )}
            <button className="btn-primary" onClick={() => setParams(moving ? {} : { move: '1' })}>
              <Wand2 size={15} /> {moving ? 'Hide' : 'Move this forward'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select className="input w-auto py-1.5 text-xs" value={p.status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} aria-label="Status">
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="input w-auto py-1.5 text-xs" value={p.cadence} onChange={(e) => store.update('projects', p.id, { cadence: e.target.value as Cadence })} aria-label="Rhythm">
            {Object.entries(CADENCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input type="date" className="input w-auto py-1.5 text-xs" value={p.dueDate ?? ''} onChange={(e) => store.update('projects', p.id, { dueDate: e.target.value || undefined })} aria-label="Date" />
          <div className="flex min-w-48 flex-1 items-center gap-3">
            <Progress value={p.progress} />
            <span className="text-xs text-muted">{p.progress}%</span>
          </div>
        </div>
      </div>

      {moving && (
        <Panel title="Move this forward">
          <MoveProjectForward project={p} />
        </Panel>
      )}

      {p.finish && (
        <Panel title="How it finished">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {(
              [
                ['Accomplished', p.finish.accomplished],
                ['Results', p.finish.results],
                ['Income', p.finish.income ? money(p.finish.income) : undefined],
                ['Impact', p.finish.impact],
                ['Learned', p.finish.learned],
                ['Reusable', p.finish.reusable],
                ['What came next', p.finish.next ? NEXT_LABEL[p.finish.next].title : undefined],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="label">{k}</dt>
                  <dd className="mt-0.5 text-mist">{v}</dd>
                </div>
              ))}
          </dl>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Panel title="Next steps">
            {openTasks.length ? (
              <ul className="-mx-3">
                {openTasks.map((t) => (
                  <li key={t.id} className="row items-center">
                    <input type="checkbox" className="h-4 w-4 accent-[#8b7cff]" checked={false} onChange={() => toggleTask(t)} aria-label={`Done: ${t.title}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{t.title}</p>
                      <p className="text-xs text-muted">
                        {t.status === 'waiting' ? `Waiting on ${t.waitingOn ?? 'someone'}` : t.dueDate ? friendlyDate(t.dueDate) : ''}
                      </p>
                    </div>
                    <select
                      className="rounded-lg border border-line bg-transparent px-1.5 py-1 text-[11px] text-muted"
                      value={t.mode}
                      onChange={(e) => store.update('tasks', t.id, { mode: e.target.value as WorkMode })}
                      aria-label="Who does it"
                    >
                      {MODES.map((m) => (
                        <option key={m} value={m}>
                          {MODE_LABEL[m]}
                        </option>
                      ))}
                    </select>
                    <button
                      className={cn('btn-ghost px-2 py-1 text-[11px]', t.status === 'waiting' && 'border-sky-400/40 text-sky-300')}
                      title="Waiting on someone"
                      onClick={() => {
                        if (t.status === 'waiting') return store.update('tasks', t.id, { status: 'todo', waitingOn: undefined, waitingSince: undefined })
                        const who = window.prompt('Waiting on whom?')
                        if (who) store.update('tasks', t.id, { status: 'waiting', waitingOn: who, waitingSince: nowIso() })
                      }}
                    >
                      <Clock size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Calm>No next steps yet. Move This Forward can suggest some.</Calm>
            )}
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newTask.trim()) return
                store.create('tasks', { title: newTask.trim(), status: 'todo', mode: newMode, projectId: p.id, areaId: p.areaId, importance: 3, source: 'manual' })
                touch()
                setNewTask('')
              }}
            >
              <input className="input py-2" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a next step" />
              <select className="input w-auto py-2 text-xs" value={newMode} onChange={(e) => setNewMode(e.target.value as WorkMode)} aria-label="Who does it">
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABEL[m]}
                  </option>
                ))}
              </select>
              <button className="btn-ghost" aria-label="Add">
                <Plus size={15} />
              </button>
            </form>
            {doneTasks.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-muted">Done ({doneTasks.length})</summary>
                <ul className="mt-2 space-y-1">
                  {doneTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm text-muted line-through">
                      <input type="checkbox" className="h-3.5 w-3.5 accent-[#8b7cff]" checked onChange={() => toggleTask(t)} aria-label={`Undo: ${t.title}`} />
                      {t.title}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Panel>

          <Panel title="AI work on this project" hint="Drafts and prepared work. Anything public waits for your approval.">
            {actions.length ? (
              <div className="space-y-3">
                {actions.map((a) => (
                  <ActionCard key={a.id} action={a} />
                ))}
              </div>
            ) : (
              <Calm>Nothing prepared yet. Use Move This Forward.</Calm>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Milestones">
            {milestones.length ? (
              <ul className="space-y-2">
                {milestones.map((m) => (
                  <li key={m.id} className="flex items-start gap-2.5 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#8b7cff]" checked={m.done} onChange={(e) => toggleMilestone(m.id, e.target.checked)} aria-label={m.title} />
                    <div className="flex-1">
                      <p className={cn(m.done ? 'text-muted line-through' : 'text-white')}>{m.title}</p>
                      {m.dueDate && !m.done && <p className="text-xs text-muted">{friendlyDate(m.dueDate)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Calm>No milestones yet.</Calm>
            )}
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newMs.trim()) return
                store.create('milestones', { projectId: p.id, title: newMs.trim(), done: false })
                setNewMs('')
              }}
            >
              <input className="input py-1.5 text-xs" value={newMs} onChange={(e) => setNewMs(e.target.value)} placeholder="Add a milestone" />
              <button className="btn-ghost py-1 text-xs">Add</button>
            </form>
          </Panel>

          {campaign && (
            <Panel title="Campaign">
              <p className="text-sm text-white">{campaign.name}</p>
              <dl className="mt-2 space-y-1 text-xs">
                {(['audience', 'message', 'offer', 'cta'] as const).map((k) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-16 shrink-0 capitalize text-muted">{k === 'cta' ? 'CTA' : k}</dt>
                    <dd className={campaign[k] ? 'text-mist' : 'text-amber-300'}>{campaign[k] ?? 'Not set'}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}

          {events.length > 0 && (
            <Panel title="On the calendar">
              <ul className="space-y-1.5 text-sm">
                {events.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span className="text-white">{e.title}</span>
                    <span className="text-xs text-muted">{friendlyDate(e.start)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Notes & decisions">
            {p.notes && <p className="mb-3 whitespace-pre-wrap text-sm text-mist">{p.notes}</p>}
            {notes.map((n) => (
              <div key={n.id} className="mb-2">
                <p className="text-sm text-white">{n.title}</p>
                <p className="text-xs text-muted">{n.body}</p>
              </div>
            ))}
            {!p.notes && !notes.length && <Calm>No notes yet.</Calm>}
          </Panel>

          <Panel title="Income connection">
            <select
              className="input py-1.5 text-xs"
              value={p.incomePotential ?? ''}
              onChange={(e) => store.update('projects', p.id, { incomePotential: (e.target.value || undefined) as typeof p.incomePotential })}
              aria-label="Income potential"
            >
              <option value="">Not decided</option>
              <option value="none">No income connection</option>
              <option value="low">Some income potential</option>
              <option value="medium">Meaningful income potential</option>
              <option value="high">Major income potential</option>
            </select>
          </Panel>

          <div className="flex flex-wrap gap-2">
            {p.status !== 'archived' && (
              <button className="btn-ghost text-xs" onClick={() => store.update('projects', p.id, { status: 'archived' })}>
                Archive
              </button>
            )}
            <button
              className="btn-ghost text-xs text-rose-300"
              onClick={() => {
                if (!window.confirm(`Delete “${p.name}” and its steps? This cannot be undone. (Archiving keeps the history.)`)) return
                for (const t of tasks) store.remove('tasks', t.id)
                for (const m of milestones) store.remove('milestones', m.id)
                store.remove('projects', p.id)
                navigate('/work')
              }}
            >
              <Trash2 size={13} /> Delete
            </button>
            <Link to="/work" className="btn-ghost text-xs">
              All work
            </Link>
          </div>
          <ModeLegend />
        </div>
      </div>

      <FinishProject project={p} open={finishing} onClose={() => setFinishing(false)} />
    </div>
  )
}

function ModeLegend() {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {MODES.map((m) => (
        <ModeBadge key={m} mode={m} />
      ))}
    </div>
  )
}
