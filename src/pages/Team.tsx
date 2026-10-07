import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { SKILLS, runSkill } from '../ai/skills'
import { useDB, useEMS } from '../app/EMSContext'
import { ActionCard } from '../components/ActionCard'
import { Calm, PageHeader, Panel } from '../components/ui'
import { MODE_LABEL } from '../domain/labels'
import { cn } from '../lib/util'

/** Skills that can run on their own without a project selected. */
const STANDALONE = new Set(['daily_brief', 'weekly_review', 'monthly_review', 'quarterly_review', 'what_next', 'needs_attention_scan', 'organize_captures', 'prep_appointments', 'waiting_on_review', 'monetize_assets', 'launch_checklist', 'event_runsheet', 'grant_prep', 'ministry_plan', 'wellness_check', 'repurpose'])

export default function Team() {
  const db = useDB()
  const { store, ai } = useEMS()
  const [running, setRunning] = useState<string | null>(null)
  const [tab, setTab] = useState<'approve' | 'activity'>('approve')
  const approvals = db.actions.filter((a) => a.state === 'needs_approval')
  const drafts = db.actions.filter((a) => a.state === 'draft')
  const history = db.actions.filter((a) => a.state === 'executed' || a.state === 'approved' || a.state === 'declined').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div>
      <PageHeader
        eyebrow="My AI Team"
        title="Your executive team"
        sub={
          <>
            Each assistant has real workflows. Anything public, external, financial, or a deletion waits for your approval.{' '}
            <span className={ai.connected ? 'text-emerald-300' : 'text-gold'}>
              {ai.connected ? 'AI is connected.' : 'No AI model is connected yet — assistants use the built-in planner and say so on everything they prepare.'}
            </span>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {db.agents.map((a) => {
            const busy = db.tasks.filter((t) => t.mode !== 'me' && t.status !== 'done' && a.areaIds.some((id) => id === t.areaId)).length
            const done = db.actions.filter((x) => x.agentKey === a.key && x.state === 'executed').length
            return (
              <article key={a.id} className="glass p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-glow/15 text-glow">
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{a.name}</p>
                    <p className="text-[11px] text-muted">
                      {done} completed{busy ? ` · ${busy} queued in its areas` : ''}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted">{a.purpose}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.skills.map((s) => {
                    const def = SKILLS[s]
                    if (!def) return null
                    const canRun = STANDALONE.has(s)
                    const k = `${a.key}_${s}`
                    return (
                      <button
                        key={s}
                        disabled={!canRun || running === k}
                        title={canRun ? `Run: ${def.name}` : 'Runs from a project’s Move This Forward'}
                        className={cn('chip', canRun ? 'cursor-pointer hover:border-glow/60 hover:text-white' : 'opacity-60')}
                        onClick={async () => {
                          setRunning(k)
                          await runSkill(store, ai, { skill: s, agentKey: a.key, title: def.name, areaId: a.areaIds[0] })
                          setRunning(null)
                          setTab('approve')
                        }}
                      >
                        {running === k && <Loader2 size={10} className="animate-spin" />}
                        {def.name}
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <button className={cn('btn-ghost text-xs', tab === 'approve' && 'border-glow/60 bg-glow/10 text-white')} onClick={() => setTab('approve')}>
              Waiting on you ({approvals.length + drafts.length})
            </button>
            <button className={cn('btn-ghost text-xs', tab === 'activity' && 'border-glow/60 bg-glow/10 text-white')} onClick={() => setTab('activity')}>
              Activity
            </button>
          </div>
          {tab === 'approve' ? (
            <>
              <Panel title="Needs your approval" hint="Draft → Needs approval → Approved → Done">
                {approvals.length ? <div className="space-y-3">{approvals.map((a) => <ActionCard key={a.id} action={a} />)}</div> : <Calm>Nothing waiting for approval.</Calm>}
              </Panel>
              <Panel title="Drafts ready for you">
                {drafts.length ? <div className="space-y-3">{drafts.map((a) => <ActionCard key={a.id} action={a} />)}</div> : <Calm>No drafts waiting.</Calm>}
              </Panel>
            </>
          ) : (
            <Panel title="What the team did">
              {history.length ? <div className="space-y-3">{history.map((a) => <ActionCard key={a.id} action={a} compact />)}</div> : <Calm>No activity yet.</Calm>}
            </Panel>
          )}
          <Panel title="How work is classified">
            <ul className="space-y-2 text-xs text-muted">
              <li>
                <span className="text-gold">{MODE_LABEL.me}</span> — decisions, approvals, public announcements, important personal choices.
              </li>
              <li>
                <span className="text-violet-300">{MODE_LABEL.ai_helps}</span> — research, drafts, outlines, analysis. You review.
              </li>
              <li>
                <span className="text-sky-300">{MODE_LABEL.ai_does}</span> — routine, internal work: organizing, recurring reports, weekly reviews.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
