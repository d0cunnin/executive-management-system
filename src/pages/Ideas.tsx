import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { areaOf, classifyCapture, evaluateIdea, monetizationScan } from '../ai/intelligence'
import { runSkill } from '../ai/skills'
import { useDB, useEMS } from '../app/EMSContext'
import { useUI } from '../app/UIContext'
import { ActionCard } from '../components/ActionCard'
import { AreaTag, Calm, DemoTag, PageHeader, Panel } from '../components/ui'
import { VERDICT_LABEL } from '../domain/labels'
import type { Idea } from '../domain/types'
import { cn } from '../lib/util'

const VERDICT_TONE: Record<string, string> = {
  strong: 'text-emerald-300 border-emerald-400/40',
  worth_exploring: 'text-violet-300 border-violet-400/40',
  later: 'text-sky-300 border-sky-400/30',
  low: 'text-muted',
  not_recommended: 'text-rose-300 border-rose-400/30',
}

export default function Ideas() {
  const db = useDB()
  const { store, ai } = useEMS()
  const ui = useUI()
  const [text, setText] = useState('')
  const [researching, setResearching] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const ideas = db.ideas.filter((i) => (showClosed ? true : i.status !== 'let_go' && i.status !== 'became_project'))
  const scan = monetizationScan(db)

  const evaluate = (i: Idea) => {
    const r = evaluateIdea(db, i)
    store.update('ideas', i.id, { ...r, status: i.status === 'new' ? 'exploring' : i.status })
  }

  return (
    <div>
      <PageHeader eyebrow="Ideas & Opportunities" title="What you might build, teach, or sell" sub="An idea is not a project. Capture it, look at it honestly, and only turn it into a project when you choose to." />

      <form
        className="glass mb-5 flex gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          const c = classifyCapture(text)
          store.create('ideas', { title: c.title, areaId: c.areaId, kind: c.type === 'opportunity' ? 'opportunity' : 'idea', status: 'new', incomePotential: c.incomeSignal ? 'medium' : undefined })
          setText('')
        }}
      >
        <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="“I’m thinking about creating a Faith + Mental Health certification…”" />
        <button className="btn-primary">
          <Plus size={15} /> Add idea
        </button>
      </form>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {ideas.map((i) => {
            const research = db.actions.filter((a) => a.skill === 'research_brief' && a.title.includes(i.title) && a.state !== 'declined')
            return (
              <article key={i.id} className="glass rise p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="mr-auto min-w-0">
                    <p className="label">{i.kind === 'opportunity' ? 'Opportunity' : 'Idea'}{i.category ? ` · ${i.category}` : ''}</p>
                    <h3 className="mt-1 text-lg font-medium text-white">{i.title}</h3>
                    {i.description && <p className="mt-1 text-sm text-muted">{i.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <AreaTag area={areaOf(db, i.areaId)} />
                      {i.incomePotential && i.incomePotential !== 'none' && <span className="chip text-gold">{i.incomePotential} income potential</span>}
                      {i.effort && <span className="chip">{i.effort} lift</span>}
                      {i.status === 'became_project' && <span className="chip text-emerald-300">became a project</span>}
                      <DemoTag show={i.demo} />
                    </div>
                  </div>
                  {i.verdict && <span className={cn('chip text-xs', VERDICT_TONE[i.verdict])}>{VERDICT_LABEL[i.verdict]}</span>}
                </div>

                {i.reasoning && (
                  <div className="mt-3 rounded-xl border border-line bg-ink-950/40 p-3">
                    <p className="label mb-1">Should I pursue this?</p>
                    <p className="text-sm text-mist">{i.reasoning}</p>
                    <p className="mt-2 text-[11px] text-muted">First pass from what’s in EMS. Demand, competition, and pricing need the Research Assistant{ai.connected ? '' : ' with AI connected'}.</p>
                  </div>
                )}
                {(i.buildsOnIds ?? []).length > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    Builds on: {(i.buildsOnIds ?? []).map((id) => db.assets.find((a) => a.id === id)?.title).filter(Boolean).join(', ')}
                  </p>
                )}
                {research.map((a) => (
                  <div key={a.id} className="mt-3">
                    <ActionCard action={a} />
                  </div>
                ))}

                {i.status !== 'became_project' && i.status !== 'let_go' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn-ghost py-1.5 text-xs" onClick={() => evaluate(i)}>
                      Should I pursue this?
                    </button>
                    <button
                      className="btn-ghost py-1.5 text-xs"
                      disabled={researching === i.id}
                      onClick={async () => {
                        setResearching(i.id)
                        await runSkill(store, ai, { skill: 'research_brief', agentKey: 'research', title: `Research: ${i.title}`, areaId: i.areaId, input: `${i.title}. ${i.description ?? ''}` })
                        setResearching(null)
                      }}
                    >
                      {researching === i.id && <Loader2 size={12} className="animate-spin" />} Research it
                    </button>
                    <button className="btn-gold py-1.5 text-xs" onClick={() => ui.openNewProject({ name: i.title, areaId: i.areaId, ideaId: i.id })}>
                      Turn into a project
                    </button>
                    <button className="btn-ghost py-1.5 text-xs text-muted" onClick={() => store.update('ideas', i.id, { status: 'let_go' })}>
                      Let it go
                    </button>
                  </div>
                )}
              </article>
            )
          })}
          {!ideas.length && <Calm>No open ideas. Capture one any time.</Calm>}
          <button className="text-xs text-muted hover:text-white" onClick={() => setShowClosed(!showClosed)}>
            {showClosed ? 'Hide' : 'Show'} ideas that became projects or were let go
          </button>
        </div>

        <Panel title="What could you build from what you already have?" hint="Existing work that isn’t earning yet. I suggest; you decide.">
          {scan.length ? (
            <ul className="space-y-4">
              {scan.map((m) => (
                <li key={m.assetId}>
                  <p className="text-sm font-medium text-white">{m.asset}</p>
                  <p className="text-xs text-muted">{m.why}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.options.map((o) => {
                      const title = `${o} from ${m.asset}`
                      const exists = db.ideas.some((x) => x.title === title)
                      return (
                        <button
                          key={o}
                          disabled={exists}
                          className={cn('chip cursor-pointer hover:border-gold/50 hover:text-gold', exists && 'border-gold/40 text-gold')}
                          onClick={() =>
                            store.create('ideas', { title, areaId: db.assets.find((a) => a.id === m.assetId)?.areaId, kind: 'opportunity', category: 'product', status: 'new', incomePotential: 'medium', buildsOnIds: [m.assetId] })
                          }
                        >
                          {exists ? '✓ ' : '+ '}
                          {o}
                        </button>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Calm>Everything you have is already being offered.</Calm>
          )}
          <p className="mt-4 text-[11px] text-muted">Outside opportunities — grants, conferences, partners, market trends — need the Research Assistant with current web sources. Not connected yet.</p>
        </Panel>
      </div>
    </div>
  )
}
