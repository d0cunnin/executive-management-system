import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { areaOf, isOpen } from '../ai/intelligence'
import { useDB } from '../app/EMSContext'
import { useUI } from '../app/UIContext'
import { ProjectCard } from '../components/ProjectCard'
import { AreaTag, Calm, ModeBadge, PageHeader, Panel, Progress } from '../components/ui'
import { CADENCE_LABEL, CHANNEL_LABEL } from '../domain/labels'
import type { Project } from '../domain/types'
import { cn, daysSince } from '../lib/util'

const GROUPS: { title: string; test: (p: Project) => boolean }[] = [
  { title: 'Needs attention', test: (p) => p.status === 'needs_attention' || p.status === 'at_risk' },
  { title: 'Active', test: (p) => p.status === 'active' },
  { title: 'Planning & ideas', test: (p) => p.status === 'planning' || p.status === 'idea' },
  { title: 'Waiting & paused', test: (p) => p.status === 'waiting' || p.status === 'paused' },
]

export default function Work() {
  const db = useDB()
  const ui = useUI()
  const [area, setArea] = useState('')
  const [tab, setTab] = useState<'projects' | 'ongoing' | 'campaigns' | 'goals' | 'finished'>('projects')
  const projects = db.projects.filter((p) => !area || p.areaId === area)
  const open = projects.filter(isOpen)

  return (
    <div>
      <PageHeader
        eyebrow="My Work"
        title="Everything in motion"
        sub="Projects finish. Ongoing work repeats. Campaigns make something happen. Goals are where it’s all heading."
        actions={
          <button className="btn-primary" onClick={() => ui.openNewProject({ areaId: area || undefined })}>
            <Plus size={15} /> New project
          </button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(['projects', 'ongoing', 'campaigns', 'goals', 'finished'] as const).map((t) => (
          <button key={t} className={cn('btn-ghost py-1.5 text-xs capitalize', tab === t && 'border-glow/60 bg-glow/10 text-white')} onClick={() => setTab(t)}>
            {t === 'ongoing' ? 'Ongoing work' : t}
          </button>
        ))}
        <select className="input ml-auto w-auto py-1.5 text-xs" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filter by area">
          <option value="">All areas</option>
          {db.areas.filter((a) => a.kind !== 'system').map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {tab === 'projects' && (
        <div className="space-y-5">
          {GROUPS.map((g) => {
            const list = open.filter(g.test)
            if (!list.length) return null
            return (
              <Panel key={g.title} title={`${g.title} · ${list.length}`}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((p) => (
                    <ProjectCard key={p.id} project={p} showArea />
                  ))}
                </div>
              </Panel>
            )
          })}
          {!open.length && <Calm>No open projects. Start one when you’re ready — not before.</Calm>}
        </div>
      )}

      {tab === 'ongoing' && (
        <Panel title="Ongoing work" hint="These repeat and never “complete”.">
          <ul className="-mx-3">
            {db.ongoing.filter((o) => !area || o.areaId === area).map((o) => (
              <li key={o.id} className="row items-center">
                <div className="flex-1">
                  <p className="text-sm text-white">{o.title}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                    <AreaTag area={areaOf(db, o.areaId)} />
                    <span>{CADENCE_LABEL[o.cadence]}</span>
                    {o.lastDoneAt && <span>last {daysSince(o.lastDoneAt)}d ago</span>}
                  </div>
                </div>
                <ModeBadge mode={o.mode} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {tab === 'campaigns' && (
        <div className="grid gap-4 md:grid-cols-2">
          {db.campaigns.filter((c) => !area || c.areaId === area).map((c) => (
            <Panel key={c.id} title={c.status}>
              <p className="display text-xl">{c.name}</p>
              <AreaTag area={areaOf(db, c.areaId)} />
              <dl className="mt-3 space-y-1 text-xs">
                {(
                  [
                    ['Trying to', c.objective],
                    ['Audience', c.audience],
                    ['Message', c.message],
                    ['Offer', c.offer],
                    ['CTA', c.cta],
                    ['Channels', c.channels.map((ch) => CHANNEL_LABEL[ch]).join(', ')],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-20 shrink-0 text-muted">{k}</dt>
                    <dd className={v ? 'text-mist' : 'text-amber-300'}>{v || 'Not set'}</dd>
                  </div>
                ))}
              </dl>
              {c.projectId && (
                <Link to={`/projects/${c.projectId}?move=1`} className="mt-3 inline-block text-xs text-glow hover:underline">
                  Move this forward →
                </Link>
              )}
            </Panel>
          ))}
          <p className="text-xs text-muted md:col-span-2">The full campaign builder (strategy, timeline, budget, results) arrives with the marketing phase.</p>
        </div>
      )}

      {tab === 'goals' && (
        <Panel title="Goals">
          <ul className="space-y-4">
            {db.goals.filter((g) => !area || g.areaId === area).map((g) => {
              const linked = db.projects.filter((p) => p.goalId === g.id && isOpen(p))
              return (
                <li key={g.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white">{g.title}</p>
                    <AreaTag area={areaOf(db, g.areaId)} />
                  </div>
                  {g.targetValue && (
                    <>
                      <Progress value={((g.current ?? 0) / g.targetValue) * 100} className="mt-1.5" />
                      <p className="mt-1 text-xs text-muted">
                        {g.current} of {g.targetValue} {g.metric?.toLowerCase()}
                      </p>
                    </>
                  )}
                  {linked.length > 0 && <p className="mt-1 text-xs text-muted">Moved by: {linked.map((p) => p.name).join(', ')}</p>}
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      {tab === 'finished' && (
        <Panel title="Finished — kept as history">
          <ul className="-mx-3">
            {projects.filter((p) => !isOpen(p)).map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="row">
                  <div className="flex-1">
                    <p className="text-sm text-white">{p.name}</p>
                    <p className="text-xs text-muted">{p.finish?.learned ?? p.status}</p>
                  </div>
                  <AreaTag area={areaOf(db, p.areaId)} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
