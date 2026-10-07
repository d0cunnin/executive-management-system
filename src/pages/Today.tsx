import { ArrowUpRight, Check, Loader2, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  aiCanDo, areaOf, comingUp, focusAdvice, incomeSummary, iNeedToHandle, loadCheck, movedForward, needsAttention, skillForTask,
  waitingOn, wellnessSummary, whatNext,
} from '../ai/intelligence'
import { runSkill } from '../ai/skills'
import { useDB, useEMS } from '../app/EMSContext'
import { AreaTag, Calm, ModeBadge, Panel } from '../components/ui'
import type { Task } from '../domain/types'
import { cn, friendlyDate, money, timeOf } from '../lib/util'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function CheckButton({ task }: { task: Task }) {
  const { store } = useEMS()
  return (
    <button
      aria-label={`Mark “${task.title}” done`}
      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-gold/50 text-gold hover:bg-gold/20"
      onClick={() => {
        store.update('tasks', task.id, { status: 'done', doneAt: new Date().toISOString() })
        if (task.projectId) {
          store.update('projects', task.projectId, { lastActivityAt: new Date().toISOString() })
          store.logProgress({ kind: 'project_advanced', title: task.title, projectId: task.projectId, areaId: task.areaId })
        }
      }}
    >
      <Check size={12} className="opacity-0 hover:opacity-100" />
    </button>
  )
}

export default function Today() {
  const db = useDB()
  const { store, ai } = useEMS()
  const [running, setRunning] = useState<string | null>(null)

  const mine = useMemo(() => iNeedToHandle(db), [db])
  const forAI = useMemo(() => aiCanDo(db), [db])
  const attention = useMemo(() => needsAttention(db), [db])
  const waiting = useMemo(() => waitingOn(db), [db])
  const upcoming = useMemo(() => comingUp(db, 10), [db])
  const income = useMemo(() => incomeSummary(db), [db])
  const wellness = useMemo(() => wellnessSummary(db), [db])
  const moved = useMemo(() => movedForward(db, 7), [db])
  const next = useMemo(() => whatNext(db), [db])
  const load = loadCheck(db)
  const focus = focusAdvice(db)
  const approvals = db.actions.filter((a) => a.state === 'needs_approval')

  const doForMe = async (t: Task) => {
    setRunning(t.id)
    await runSkill(store, ai, { ...skillForTask(t), title: t.title, projectId: t.projectId, areaId: t.areaId, taskId: t.id })
    setRunning(null)
  }

  const summary = [
    mine.length ? `${mine.length} thing${mine.length === 1 ? '' : 's'} need${mine.length === 1 ? 's' : ''} you` : 'Nothing needs you personally',
    forAI.length ? `AI can take ${forAI.length}` : null,
    attention.filter((a) => a.severity === 3).length ? `${attention.filter((a) => a.severity === 3).length} need${attention.filter((a) => a.severity === 3).length === 1 ? 's' : ''} a decision` : 'nothing is on fire',
  ].filter(Boolean).join(' · ')

  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="label">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="display mt-1 text-4xl sm:text-5xl">{greeting()}, D’Andrea.</h1>
        <p className="mt-2 text-muted">{summary}.</p>
        {(load || focus) && (
          <p className="mt-3 max-w-3xl rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3.5 py-2.5 text-sm text-emerald-100">{load ?? focus}</p>
        )}
      </header>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Panel title="I need to handle" hint="Only what truly needs you.">
            {mine.length ? (
              <ul className="-mx-3">
                {mine.map((t) => (
                  <li key={t.id} className="row">
                    <CheckButton task={t} />
                    <div className="min-w-0 flex-1">
                      <Link to={t.projectId ? `/projects/${t.projectId}` : '/tasks'} className="text-[15px] text-white hover:underline">
                        {t.title}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                        <AreaTag area={areaOf(db, t.areaId)} />
                        {t.dueDate && <span className={cn(friendlyDate(t.dueDate) === 'Today' && 'text-gold')}>{friendlyDate(t.dueDate)}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Calm>Nothing needs you personally right now.</Calm>
            )}
          </Panel>

          <Panel
            title="AI can do"
            hint={ai.connected ? 'Your connected AI drafts; you approve anything public.' : 'Built-in planner prepares templates from your data. Connect AI for full drafts.'}
            action={approvals.length > 0 && <Link to="/team" className="btn-gold shrink-0 whitespace-nowrap py-1 text-xs">{approvals.length} to approve</Link>}
          >
            {forAI.length ? (
              <ul className="-mx-3">
                {forAI.slice(0, 6).map((t) => (
                  <li key={t.id} className="row items-center">
                    <Sparkles size={15} className="shrink-0 text-glow" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{t.title}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <ModeBadge mode={t.mode} />
                        <AreaTag area={areaOf(db, t.areaId)} />
                      </div>
                    </div>
                    {t.status === 'doing' ? (
                      <Link to="/team" className="btn-ghost py-1.5 text-xs">Review</Link>
                    ) : (
                      <button className="btn-primary py-1.5 text-xs" onClick={() => doForMe(t)} disabled={running === t.id}>
                        {running === t.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Do it
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Calm>Nothing queued for AI.</Calm>
            )}
          </Panel>

          <Panel title="Needs attention" hint="Starting to stall, or waiting on a decision.">
            {attention.length ? (
              <ul className="-mx-3">
                {attention.slice(0, 6).map((a) => (
                  <li key={a.key}>
                    <Link to={a.href} className="row">
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.severity === 3 ? 'bg-amber-300' : a.severity === 2 ? 'bg-violet-300' : 'bg-white/30')} />
                      <div>
                        <p className="text-sm text-white">{a.title}</p>
                        <p className="text-xs text-muted">{a.why}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Calm />
            )}
          </Panel>

          <Panel title="What should I work on next?" action={<Link to="/assistant?q=What%20should%20I%20work%20on%20next%3F" className="text-xs text-muted hover:text-white">Ask why →</Link>}>
            {next.length ? (
              <ol className="grid gap-3 md:grid-cols-3">
                {next.map((r, i) => (
                  <li key={r.projectId}>
                    <Link to={`/projects/${r.projectId}?move=1`} className="block h-full rounded-xl border border-line p-3.5 transition-colors hover:border-glow/50 hover:bg-glow/5">
                      <p className="display text-3xl text-glow/80">{i + 1}</p>
                      <p className="mt-1 text-sm font-medium text-white">{r.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{r.why}</p>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <Calm>Nothing stands out. Finishing small things — or resting — is a fine choice today.</Calm>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Coming up" action={<Link to="/calendar" className="text-xs text-muted hover:text-white">Calendar →</Link>}>
            {upcoming.length ? (
              <ul className="space-y-2.5">
                {upcoming.slice(0, 7).map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="w-20 shrink-0 text-xs text-muted">
                      <p className={cn(friendlyDate(e.start) === 'Today' && 'text-gold')}>{friendlyDate(e.start)}</p>
                      <p>{timeOf(e.start)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{e.title}</p>
                      <AreaTag area={areaOf(db, e.areaId)} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Calm>The next ten days are open.</Calm>
            )}
          </Panel>

          <Panel title="Waiting on">
            {waiting.length ? (
              <ul className="space-y-2">
                {waiting.map((t) => (
                  <li key={t.id} className="text-sm">
                    <p className="text-white">{t.title}</p>
                    <p className={cn('text-xs', t.days >= 7 ? 'text-amber-300' : 'text-muted')}>
                      {t.waitingOn} · {t.days} day{t.days === 1 ? '' : 's'}
                      {t.days >= 5 && ' · time to follow up'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Calm>You are not waiting on anyone.</Calm>
            )}
          </Panel>

          <Panel title="Income" action={<Link to="/income" className="text-xs text-muted hover:text-white">Details →</Link>}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="display text-3xl text-gold">{money(income.receivedThisMonth)}</p>
                <p className="text-xs text-muted">Received this month</p>
              </div>
              <div>
                <p className="display text-3xl text-white">{money(income.expected)}</p>
                <p className="text-xs text-muted">Expected — not yet received</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted">Forecasts {money(income.forecast)} · Estimates {money(income.estimate)} — not guaranteed.</p>
          </Panel>

          <Panel title="Wellness" action={<Link to="/wellness" className="text-xs text-muted hover:text-white">Check in →</Link>}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat value={`${wellness.movement}`} label="active min this week" />
              <Stat value={`${wellness.activeDays}/7`} label="days moving" />
              <Stat value={wellness.sleep ? `${wellness.sleep}h` : '—'} label="avg sleep" />
            </div>
            {!wellness.today && (
              <Link to="/wellness" className="btn-ghost mt-3 w-full justify-center py-1.5 text-xs">
                Log today
              </Link>
            )}
          </Panel>

          <Panel title="What moved forward" hint="This week">
            {moved.length ? (
              <ul className="space-y-2">
                {moved.slice(0, 6).map((m) => (
                  <li key={m.id} className="flex gap-2 text-sm">
                    <ArrowUpRight size={15} className="mt-0.5 shrink-0 text-emerald-300" />
                    <div>
                      <p className="text-white">{m.title}</p>
                      <p className="text-xs text-muted">{friendlyDate(m.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Calm>Nothing recorded yet this week.</Calm>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-2 py-3">
      <p className="display text-2xl text-white">{value}</p>
      <p className="text-[10px] leading-tight text-muted">{label}</p>
    </div>
  )
}
