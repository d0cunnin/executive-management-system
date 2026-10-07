import { Link } from 'react-router-dom'
import { areaOf, projectTasks } from '../ai/intelligence'
import { useDB } from '../app/EMSContext'
import type { Project } from '../domain/types'
import { daysSince, friendlyDate } from '../lib/util'
import { AreaTag, DemoTag, Progress, StatusPill } from './ui'

export function ProjectCard({ project: p, showArea }: { project: Project; showArea?: boolean }) {
  const db = useDB()
  const open = projectTasks(db, p.id).filter((t) => t.status !== 'done')
  const mine = open.filter((t) => t.mode === 'me' && t.status !== 'waiting').length
  const ai = open.filter((t) => t.mode !== 'me').length
  const idle = daysSince(p.lastActivityAt)
  return (
    <Link to={`/projects/${p.id}`} className="block rounded-xl border border-line bg-ink-950/30 p-3.5 transition-colors hover:border-glow/40 hover:bg-glow/[0.04]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white">{p.name}</p>
        <StatusPill status={p.status} />
      </div>
      {showArea && (
        <div className="mt-1">
          <AreaTag area={areaOf(db, p.areaId)} />
        </div>
      )}
      <Progress value={p.progress} className="mt-3" />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span>{p.progress}%</span>
        {p.dueDate && <span>{friendlyDate(p.dueDate)}</span>}
        {mine > 0 && <span className="text-gold">{mine} for you</span>}
        {ai > 0 && <span className="text-violet-300">{ai} for AI</span>}
        {idle >= 7 && <span className="text-amber-300">quiet {idle}d</span>}
        <DemoTag show={p.demo} />
      </div>
      {p.blocker && <p className="mt-2 text-xs text-amber-200/90">{p.blocker}</p>}
    </Link>
  )
}
