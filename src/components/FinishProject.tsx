import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEMS } from '../app/EMSContext'
import { NEXT_LABEL } from '../domain/labels'
import type { Project, WhatComesNext } from '../domain/types'
import { cn } from '../lib/util'
import { Field, Modal } from './ui'

/**
 * Finishing is a short reflection, not a delete. The answers become part of
 * the project's history, and WHAT COMES NEXT turns into a real next step.
 */
export function FinishProject({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const { store } = useEMS()
  const navigate = useNavigate()
  const [f, setF] = useState({ accomplished: '', results: '', income: '', impact: '', learned: '', reusable: '', followUps: '' })
  const [next, setNext] = useState<WhatComesNext>('rest')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  function finish() {
    const now = new Date().toISOString()
    const income = Number(f.income) || undefined
    store.update('projects', project.id, {
      status: 'completed',
      progress: 100,
      lastActivityAt: now,
      finish: { accomplished: f.accomplished || project.outcome, results: f.results, income, impact: f.impact, learned: f.learned, reusable: f.reusable, next, finishedAt: now },
    })
    store.logProgress({ kind: 'completed', title: `Completed: ${project.name}`, projectId: project.id, areaId: project.areaId })
    if (income) {
      store.create('income', { label: `${project.name} — result`, amount: income, certainty: 'actual', date: now.slice(0, 10), areaId: project.areaId, source: 'other' })
      store.logProgress({ kind: 'income', title: `Income from ${project.name}`, projectId: project.id, areaId: project.areaId })
    }
    for (const line of f.followUps.split('\n').map((s) => s.trim()).filter(Boolean)) {
      store.create('tasks', { title: line, status: 'todo', mode: 'me', areaId: project.areaId, importance: 3, source: 'manual' })
    }
    if (f.reusable.trim()) {
      const asset = store.create('assets', { title: f.reusable.trim(), kind: 'presentation', areaId: project.areaId, status: 'complete', description: `From ${project.name}` })
      store.create('links', { fromType: 'project', fromId: project.id, toType: 'asset', toId: asset.id, relation: 'produced' })
    }
    // Turn the choice into a concrete next move.
    const seed: Record<WhatComesNext, (() => void) | null> = {
      build_on: () => store.create('ideas', { title: `Build on: ${project.name}`, areaId: project.areaId, kind: 'idea', status: 'new', buildsOnIds: [] }),
      monetize: () => store.create('ideas', { title: `Monetize: ${project.name}`, areaId: project.areaId, kind: 'opportunity', category: 'product', status: 'new', incomePotential: 'medium' }),
      repurpose: () => store.create('ideas', { title: `Repurpose: ${project.name}`, areaId: project.areaId, kind: 'idea', category: 'content', status: 'new' }),
      promote: () => store.create('ideas', { title: `Promote: ${project.name}`, areaId: project.areaId, kind: 'idea', category: 'content', status: 'new' }),
      create_new: () => null,
      rest: null,
    }
    seed[next]?.()
    onClose()
    navigate(next === 'rest' ? `/projects/${project.id}` : '/ideas')
  }

  return (
    <Modal open={open} onClose={onClose} title={`Finish: ${project.name}`} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What was accomplished?">
          <textarea className="input" rows={2} value={f.accomplished} onChange={set('accomplished')} placeholder={project.outcome} />
        </Field>
        <Field label="What were the results?">
          <textarea className="input" rows={2} value={f.results} onChange={set('results')} />
        </Field>
        <Field label="Was there income? (received, in dollars)">
          <input className="input" inputMode="decimal" value={f.income} onChange={set('income')} placeholder="0" />
        </Field>
        <Field label="What impact did it have?">
          <input className="input" value={f.impact} onChange={set('impact')} />
        </Field>
        <Field label="What did we learn?">
          <textarea className="input" rows={2} value={f.learned} onChange={set('learned')} />
        </Field>
        <Field label="Reusable materials?" hint="Saved to My Information and linked to this project.">
          <input className="input" value={f.reusable} onChange={set('reusable')} placeholder="Slides, recordings, handouts…" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Follow-up to-dos (one per line)">
            <textarea className="input" rows={2} value={f.followUps} onChange={set('followUps')} />
          </Field>
        </div>
      </div>
      <p className="label mt-6 mb-2">What comes next?</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(NEXT_LABEL) as WhatComesNext[]).map((k) => (
          <button key={k} onClick={() => setNext(k)} className={cn('rounded-xl border p-3 text-left transition-colors', next === k ? 'border-glow/60 bg-glow/10' : 'border-line hover:border-line-strong')}>
            <p className="text-sm font-medium text-white">{NEXT_LABEL[k].title}</p>
            <p className="text-xs text-muted">{NEXT_LABEL[k].hint}</p>
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Not yet
        </button>
        <button className="btn-primary" onClick={finish}>
          Finish and keep the history
        </button>
      </div>
    </Modal>
  )
}
