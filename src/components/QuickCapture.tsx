import { Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { classifyCapture } from '../ai/intelligence'
import { useDB, useEMS } from '../app/EMSContext'
import { useUI } from '../app/UIContext'
import type { CaptureType, EntityType } from '../domain/types'
import { cn, dayOffset } from '../lib/util'
import { Modal } from './ui'

const TYPES: { key: CaptureType; label: string }[] = [
  { key: 'task', label: 'To-do' },
  { key: 'idea', label: 'Idea' },
  { key: 'opportunity', label: 'Opportunity' },
  { key: 'project', label: 'Project' },
  { key: 'reminder', label: 'Reminder' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'note', label: 'Note' },
  { key: 'content', label: 'Content idea' },
  { key: 'contact', label: 'Person' },
]

const HREF: Partial<Record<EntityType, (id: string) => string>> = {
  project: (id) => `/projects/${id}`,
  idea: () => '/ideas',
  task: () => '/tasks',
  note: () => '/information',
  content: () => '/information',
  contact: () => '/information',
}

export function QuickCapture() {
  const ui = useUI()
  const { store } = useEMS()
  const db = useDB()
  const [text, setText] = useState('')
  const [typeOverride, setTypeOverride] = useState<CaptureType | null>(null)
  const [areaOverride, setAreaOverride] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ label: string; href: string; possibleProject?: string; areaId?: string; ideaId?: string } | null>(null)

  useEffect(() => {
    if (ui.capture.open) {
      setText(ui.capture.text ?? '')
      setTypeOverride(null)
      setAreaOverride(null)
      setSaved(null)
    }
  }, [ui.capture.open, ui.capture.text])

  const guess = useMemo(() => classifyCapture(text), [text])
  const type = typeOverride ?? guess.type
  const areaId = areaOverride ?? guess.areaId
  const area = db.areas.find((a) => a.id === areaId)

  function save() {
    if (!text.trim()) return
    const title = guess.title
    let created: { type: EntityType; id: string }
    switch (type) {
      case 'task':
      case 'reminder': {
        const t = store.create('tasks', { title, status: 'todo', mode: 'me', areaId, importance: 3, source: 'capture', dueDate: type === 'reminder' ? dayOffset(1) : undefined })
        created = { type: 'task', id: t.id }
        break
      }
      case 'idea':
      case 'opportunity': {
        const i = store.create('ideas', { title, areaId, kind: type, status: 'new', incomePotential: guess.incomeSignal ? 'medium' : undefined })
        created = { type: 'idea', id: i.id }
        break
      }
      case 'project': {
        const p = store.create('projects', { name: title, outcome: title, areaId: areaId ?? 'area_personal', status: 'planning', cadence: 'none', progress: 0, lastActivityAt: new Date().toISOString(), incomePotential: guess.incomeSignal ? 'medium' : undefined })
        created = { type: 'project', id: p.id }
        break
      }
      case 'contact': {
        const c = store.create('contacts', { name: title, areaIds: areaId ? [areaId] : [], notes: text })
        created = { type: 'contact', id: c.id }
        break
      }
      case 'content': {
        const c = store.create('content', { title, areaId, kind: 'post', status: 'idea' })
        created = { type: 'content', id: c.id }
        break
      }
      default: {
        const n = store.create('notes', { title: title.slice(0, 80), body: text, areaId, kind: type === 'meeting' ? 'meeting' : 'note' })
        created = { type: 'note', id: n.id }
      }
    }
    store.create('captures', { text, classifiedAs: type, areaId, createdRecord: created })
    setSaved({
      label: `Saved as ${TYPES.find((t) => t.key === type)?.label.toLowerCase()}${area ? ` in ${area.name}` : ''}.`,
      href: HREF[created.type]?.(created.id) ?? '/',
      possibleProject: type !== 'project' ? guess.possibleProject : undefined,
      areaId,
      ideaId: created.type === 'idea' ? created.id : undefined,
    })
    setText('')
  }

  return (
    <Modal open={ui.capture.open} onClose={ui.close} title="Quick capture">
      {saved ? (
        <div className="space-y-4">
          <p className="text-white">{saved.label}</p>
          {saved.possibleProject && (
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-sm">
              <p className="text-gold">This could become a project{guess.incomeSignal ? ' — and possibly income' : ''}.</p>
              <p className="mt-1 text-muted">I kept it as an idea so you can decide first.</p>
              <button className="btn-gold mt-3" onClick={() => ui.openNewProject({ name: saved.possibleProject, areaId: saved.areaId, ideaId: saved.ideaId })}>
                Turn into a project
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Link to={saved.href} className="btn-ghost" onClick={ui.close}>
              Open it
            </Link>
            <button className="btn-primary" onClick={() => setSaved(null)}>
              Capture another
            </button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <textarea
            autoFocus
            rows={3}
            className="input resize-none text-base"
            placeholder="Anything — “Need to create a workbook for Faith + Mental Health 101”"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
            }}
          />
          {text.trim() && (
            <div className="space-y-3 rounded-xl border border-line bg-ink-950/40 p-3">
              <p className="flex items-center gap-2 text-xs text-muted">
                <Sparkles size={13} className="text-glow" />
                I read this as{' '}
                <strong className="text-white">{TYPES.find((t) => t.key === type)?.label}</strong>
                {area && (
                  <>
                    in <strong className="text-white">{area.name}</strong>
                  </>
                )}
                {guess.incomeSignal && <span className="chip text-gold">possible income</span>}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((t) => (
                  <button type="button" key={t.key} onClick={() => setTypeOverride(t.key)} className={cn('chip cursor-pointer', t.key === type && 'border-glow/60 bg-glow/15 text-white')}>
                    {t.label}
                  </button>
                ))}
              </div>
              <select className="input py-1.5 text-xs" value={areaId ?? ''} onChange={(e) => setAreaOverride(e.target.value || null)} aria-label="Area">
                <option value="">No area</option>
                {db.areas.filter((a) => a.kind !== 'system').map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted">You don’t need to sort it. I’ll file it.</p>
            <button className="btn-primary" disabled={!text.trim()}>
              Save
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
