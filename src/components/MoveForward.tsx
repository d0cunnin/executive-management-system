import { ArrowRight, Check, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { moveAreaForward, moveProjectForward, type ProposedAction } from '../ai/intelligence'
import { runSkill } from '../ai/skills'
import { useDB, useEMS } from '../app/EMSContext'
import { CADENCE_LABEL } from '../domain/labels'
import type { Cadence, Project } from '../domain/types'
import { cn, friendlyDate } from '../lib/util'
import { ActionCard } from './ActionCard'
import { Calm } from './ui'

function useRunner(projectId?: string, areaId?: string) {
  const { store, ai } = useEMS()
  const [running, setRunning] = useState<Record<string, boolean>>({})
  const [doneIds, setDoneIds] = useState<Record<string, string>>({})
  const run = async (a: ProposedAction, pid = projectId) => {
    setRunning((r) => ({ ...r, [a.key]: true }))
    const action = await runSkill(store, ai, { skill: a.skill, agentKey: a.agentKey, title: a.label, projectId: pid, areaId, taskId: a.taskId, consequential: a.consequential })
    setRunning((r) => ({ ...r, [a.key]: false }))
    setDoneIds((d) => ({ ...d, [a.key]: action.id }))
  }
  return { running, doneIds, run }
}

function ActionButton({ a, running, onRun, ran, context }: { a: ProposedAction; running?: boolean; onRun: () => void; ran?: boolean; context?: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-ink-950/30 px-3 py-2.5">
      <Wand2 size={15} className="shrink-0 text-glow" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{a.label}</p>
        <p className="text-[11px] text-muted">
          {context && <span className="text-mist">{context} · </span>}
          {a.consequential ? 'AI prepares it · you approve before anything goes out' : 'AI can do this now'}
        </p>
      </div>
      <button className={cn(ran ? 'btn-ghost' : 'btn-primary', 'shrink-0 py-1.5 text-xs')} onClick={onRun} disabled={running || ran}>
        {running ? <Loader2 size={13} className="animate-spin" /> : ran ? <Check size={13} /> : <Sparkles size={13} />}
        {ran ? 'Prepared' : 'Do it'}
      </button>
    </li>
  )
}

export function MoveProjectForward({ project }: { project: Project }) {
  const db = useDB()
  const { store } = useEMS()
  const plan = useMemo(() => moveProjectForward(db, project), [db, project])
  const { running, doneIds, run } = useRunner(project.id, project.areaId)
  const prepared = Object.values(doneIds).map((id) => db.actions.find((a) => a.id === id)).filter(Boolean)

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-glow/30 bg-gradient-to-br from-glow/15 to-transparent p-4">
        <p className="label mb-1 text-glow">Where we are</p>
        <p className="display text-xl leading-snug sm:text-2xl">{plan.headline}</p>
        <p className="mt-1 text-xs text-muted">{plan.where}</p>
      </div>

      {plan.nothingNeeded && <Calm>Nothing needs your attention here right now. This can wait.</Calm>}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <Section title="Trying to accomplish">
            <p className="text-sm text-white">{plan.goal}</p>
          </Section>
          {plan.blocking.length > 0 && (
            <Section title="What is in the way">
              <ul className="space-y-1 text-sm text-amber-200">
                {plan.blocking.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </Section>
          )}
          {plan.done.length > 0 && (
            <Section title="Already done">
              <ul className="space-y-1 text-sm text-muted">
                {plan.done.map((d) => (
                  <li key={d} className="flex gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                    {d}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Next milestone">
            <p className="text-sm text-white">
              {plan.nextMilestone ? plan.nextMilestone.title : 'None set yet.'}
              {plan.nextMilestone?.due && <span className="text-muted"> · {friendlyDate(plan.nextMilestone.due)}</span>}
            </p>
            {(plan.deadline || plan.cadence) && (
              <p className="mt-1 text-xs text-muted">
                {plan.deadline && `Project date: ${friendlyDate(plan.deadline)}`}
                {plan.deadline && plan.cadence && ' · '}
                {plan.cadence && `Rhythm: ${CADENCE_LABEL[plan.cadence as Cadence]}`}
              </p>
            )}
          </Section>
          {plan.missing.length > 0 && (
            <Section title="Missing information">
              <ul className="space-y-1 text-sm text-muted">
                {plan.missing.map((m) => (
                  <li key={m}>• {m}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <Section title="AI can do now">
            {plan.aiCanDo.length ? (
              <ul className="space-y-2">
                {plan.aiCanDo.map((a) => (
                  <ActionButton key={a.key} a={a} running={running[a.key]} ran={!!doneIds[a.key]} onRun={() => run(a)} />
                ))}
              </ul>
            ) : (
              <Calm>Nothing for AI here right now.</Calm>
            )}
          </Section>
          <Section title="You need to">
            {plan.youNeedTo.length ? (
              <ul className="space-y-1.5">
                {plan.youNeedTo.map((title) => {
                  const t = db.tasks.find((x) => x.title === title && x.projectId === project.id)
                  return (
                    <li key={title} className="flex items-center gap-2 text-sm text-white">
                      <button
                        aria-label={`Mark “${title}” done`}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-gold/50 hover:bg-gold/20"
                        onClick={() => {
                          if (!t) return
                          store.update('tasks', t.id, { status: 'done', doneAt: new Date().toISOString() })
                          store.update('projects', project.id, { lastActivityAt: new Date().toISOString() })
                          store.logProgress({ kind: 'project_advanced', title: t.title, projectId: project.id, areaId: project.areaId })
                        }}
                      />
                      {title}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing only you can do right now.</p>
            )}
          </Section>
          {plan.delegate.length > 0 && (
            <Section title="Could be delegated">
              <ul className="space-y-1 text-sm text-muted">
                {plan.delegate.map((d) => (
                  <li key={d}>• {d}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>

      {prepared.length > 0 && (
        <div className="space-y-3">
          <p className="label">Prepared just now</p>
          {prepared.map((a) => (
            <ActionCard key={a!.id} action={a!} />
          ))}
        </div>
      )}
    </div>
  )
}

export function MoveAreaForward({ areaId }: { areaId: string }) {
  const db = useDB()
  const plan = useMemo(() => moveAreaForward(db, areaId), [db, areaId])
  const { running, doneIds, run } = useRunner(undefined, areaId)
  const prepared = Object.values(doneIds).map((id) => db.actions.find((a) => a.id === id)).filter(Boolean)
  const myDecisions = plan.plans.flatMap((x) => x.plan.youNeedTo.slice(0, 1).map((y) => ({ y, p: x.project })))

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-glow/30 bg-gradient-to-br from-glow/15 to-transparent p-4">
        <p className="label mb-1 text-glow">The read</p>
        <p className="display text-xl leading-snug sm:text-2xl">{plan.headline}</p>
      </div>
      {plan.quiet && <Calm>Nothing needs your attention here right now.</Calm>}
      <div className="grid gap-5 md:grid-cols-2">
        <Section title="AI can do now">
          <ul className="space-y-2">
            {plan.plans.flatMap(({ project, plan: p }) =>
              p.aiCanDo.slice(0, 3).map((a) => {
                const key = `${project.id}_${a.key}`
                return <ActionButton key={key} a={{ ...a, key }} context={project.name} running={running[key]} ran={!!doneIds[key]} onRun={() => run({ ...a, key }, project.id)} />
              }),
            )}
          </ul>
          {!plan.plans.some((x) => x.plan.aiCanDo.length) && <Calm>Nothing for AI here right now.</Calm>}
        </Section>
        <Section title="You need to decide or do">
          {myDecisions.length ? (
            <ul className="space-y-2">
              {myDecisions.map(({ y, p }) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="row -mx-3 block">
                    <p className="text-sm text-white">{y}</p>
                    <p className="text-xs text-muted">{p.name}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing only you can do here right now.</p>
          )}
          {plan.moving.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300/90">
              <ArrowRight size={12} /> On track: {plan.moving.map((m) => m.name).join(', ')}
            </p>
          )}
        </Section>
      </div>
      {prepared.length > 0 && (
        <div className="space-y-3">
          <p className="label">Prepared just now</p>
          {prepared.map((a) => (
            <ActionCard key={a!.id} action={a!} />
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-2">{title}</p>
      {children}
    </div>
  )
}
