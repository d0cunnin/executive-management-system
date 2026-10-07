import { Loader2, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { areaOf, skillForTask } from '../ai/intelligence'
import { runSkill } from '../ai/skills'
import { useDB, useEMS } from '../app/EMSContext'
import { AreaTag, Calm, PageHeader, Panel } from '../components/ui'
import { MODE_LABEL } from '../domain/labels'
import type { Task, WorkMode } from '../domain/types'
import { cn, friendlyDate, nowIso } from '../lib/util'

const COLS: { mode: WorkMode; hint: string }[] = [
  { mode: 'me', hint: 'Decisions and work only you can do.' },
  { mode: 'ai_helps', hint: 'AI prepares it; you review and finish.' },
  { mode: 'ai_does', hint: 'Routine work AI can handle.' },
]

export default function Tasks() {
  const db = useDB()
  const { store, ai } = useEMS()
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<WorkMode>('me')
  const [running, setRunning] = useState<string | null>(null)
  const open = db.tasks.filter((t) => t.status === 'todo' || t.status === 'doing')
  const waiting = db.tasks.filter((t) => t.status === 'waiting')

  const done = (t: Task) => {
    store.update('tasks', t.id, { status: 'done', doneAt: nowIso() })
    if (t.projectId) {
      store.update('projects', t.projectId, { lastActivityAt: nowIso() })
      store.logProgress({ kind: 'project_advanced', title: t.title, projectId: t.projectId, areaId: t.areaId })
    }
  }

  return (
    <div>
      <PageHeader eyebrow="To-dos" title="Who does what" sub="Every to-do sits with you, with AI helping, or with AI doing it. Move them between columns any time." />
      <form
        className="glass mb-5 flex flex-wrap gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          store.create('tasks', { title: title.trim(), status: 'todo', mode, importance: 3, source: 'manual' })
          setTitle('')
        }}
      >
        <input className="input min-w-0 flex-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a to-do" />
        <select className="input w-auto" value={mode} onChange={(e) => setMode(e.target.value as WorkMode)} aria-label="Who does it">
          {COLS.map((c) => (
            <option key={c.mode} value={c.mode}>
              {MODE_LABEL[c.mode]}
            </option>
          ))}
        </select>
        <button className="btn-primary">
          <Plus size={15} /> Add
        </button>
      </form>

      <div className="grid gap-5 lg:grid-cols-3">
        {COLS.map((c) => {
          const list = open.filter((t) => t.mode === c.mode).sort((a, b) => b.importance - a.importance)
          return (
            <Panel key={c.mode} title={`${MODE_LABEL[c.mode]} · ${list.length}`} hint={c.hint}>
              {list.length ? (
                <ul className="-mx-3">
                  {list.map((t) => (
                    <li key={t.id} className="row">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[#8b7cff]" checked={false} onChange={() => done(t)} aria-label={`Done: ${t.title}`} />
                      <div className="min-w-0 flex-1">
                        {t.projectId ? (
                          <Link to={`/projects/${t.projectId}`} className="text-sm text-white hover:underline">
                            {t.title}
                          </Link>
                        ) : (
                          <p className="text-sm text-white">{t.title}</p>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                          <AreaTag area={areaOf(db, t.areaId)} />
                          {t.dueDate && <span>{friendlyDate(t.dueDate)}</span>}
                          {t.status === 'doing' && c.mode !== 'me' && <Link to="/team" className="text-gold">prepared — review</Link>}
                        </div>
                        <div className="mt-1.5 flex gap-1">
                          {COLS.filter((x) => x.mode !== c.mode).map((x) => (
                            <button key={x.mode} className="chip cursor-pointer hover:text-white" onClick={() => store.update('tasks', t.id, { mode: x.mode })}>
                              → {MODE_LABEL[x.mode]}
                            </button>
                          ))}
                        </div>
                      </div>
                      {c.mode !== 'me' && t.status === 'todo' && (
                        <button
                          className="btn-primary px-2.5 py-1 text-xs"
                          disabled={running === t.id}
                          onClick={async () => {
                            setRunning(t.id)
                            await runSkill(store, ai, { ...skillForTask(t), title: t.title, projectId: t.projectId, areaId: t.areaId, taskId: t.id })
                            setRunning(null)
                          }}
                        >
                          {running === t.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Calm>Clear.</Calm>
              )}
            </Panel>
          )
        })}
      </div>

      <Panel title={`Waiting on · ${waiting.length}`} className="mt-5">
        {waiting.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {waiting.map((t) => (
              <li key={t.id} className="rounded-xl border border-line p-3 text-sm">
                <p className="text-white">{t.title}</p>
                <p className={cn('text-xs', 'text-muted')}>{t.waitingOn}</p>
                <button className="mt-2 text-xs text-glow hover:underline" onClick={() => store.update('tasks', t.id, { status: 'todo', waitingOn: undefined, waitingSince: undefined })}>
                  It arrived
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Calm>You are not waiting on anyone.</Calm>
        )}
      </Panel>
    </div>
  )
}
