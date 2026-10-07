import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MODE_LABEL, STATUS_LABEL } from '../domain/labels'
import type { Area, ProjectStatus, WorkMode } from '../domain/types'
import { cn } from '../lib/util'

export function Panel({ title, hint, action, children, className, id }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('glass rise p-4 sm:p-5', className)}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="label">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted/80">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** The system saying, plainly, that nothing is needed. */
export function Calm({ children = 'Nothing needs your attention here right now.' }: { children?: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">{children}</p>
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="label mb-1">{eyebrow}</p>}
        <h1 className="display text-3xl sm:text-4xl">{title}</h1>
        {sub && <div className="mt-1.5 max-w-2xl text-sm text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const STATUS_TONE: Partial<Record<ProjectStatus, string>> = {
  active: 'text-emerald-300 border-emerald-400/30',
  needs_attention: 'text-amber-300 border-amber-400/40',
  at_risk: 'text-rose-300 border-rose-400/40',
  waiting: 'text-sky-300 border-sky-400/30',
  completed: 'text-gold border-gold/30',
  planning: 'text-violet-300 border-violet-400/30',
}

export function StatusPill({ status }: { status: ProjectStatus }) {
  return <span className={cn('chip', STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>
}

const MODE_TONE: Record<WorkMode, string> = {
  me: 'text-gold border-gold/30',
  ai_helps: 'text-violet-300 border-violet-400/30',
  ai_does: 'text-sky-300 border-sky-400/30',
}

export function ModeBadge({ mode }: { mode: WorkMode }) {
  return <span className={cn('chip uppercase tracking-wider', MODE_TONE[mode])}>{MODE_LABEL[mode]}</span>
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/5', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-glow to-[#c4b5fd]" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

export function AreaTag({ area }: { area?: Area }) {
  if (!area) return null
  return (
    <Link to={`/areas/${area.slug}`} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: area.color }} />
      {area.name}
    </Link>
  )
}

export function DemoTag({ show }: { show?: boolean }) {
  if (!show) return null
  return <span className="chip border-dashed text-[10px]" title="Sample data for the demo">sample</span>
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={cn('glass rise max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-2xl sm:p-6', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-2xl">{title}</h2>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={onClose} aria-label="Close">
            Esc
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted/70">{hint}</span>}
    </label>
  )
}
