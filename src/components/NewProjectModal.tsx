import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { classifyCapture } from '../ai/intelligence'
import { useDB, useEMS } from '../app/EMSContext'
import { useUI } from '../app/UIContext'
import { CADENCE_LABEL } from '../domain/labels'
import type { Cadence } from '../domain/types'
import { Field, Modal } from './ui'

export function NewProjectModal() {
  const ui = useUI()
  const { store } = useEMS()
  const db = useDB()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [outcome, setOutcome] = useState('')
  const [areaId, setAreaId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [cadence, setCadence] = useState<Cadence>('none')
  const [notes, setNotes] = useState('')
  const [more, setMore] = useState(false)

  useEffect(() => {
    if (!ui.newProject.open) return
    setName(ui.newProject.name ?? '')
    setOutcome('')
    setAreaId(ui.newProject.areaId ?? '')
    setDueDate('')
    setCadence('none')
    setNotes('')
    setMore(false)
  }, [ui.newProject])

  // Suggest an area from the name if she has not picked one.
  const suggested = name ? classifyCapture(name).areaId : undefined
  const effectiveArea = areaId || suggested || 'area_personal'

  function create() {
    if (!name.trim()) return
    const p = store.create('projects', {
      name: name.trim(),
      outcome: outcome.trim() || name.trim(),
      areaId: effectiveArea,
      status: 'planning',
      cadence,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      progress: 0,
      lastActivityAt: new Date().toISOString(),
      incomePotential: classifyCapture(`${name} ${outcome}`).incomeSignal ? 'medium' : undefined,
    })
    if (ui.newProject.ideaId) store.update('ideas', ui.newProject.ideaId, { status: 'became_project', projectId: p.id })
    store.logProgress({ kind: 'decision', title: `Started project: ${p.name}`, projectId: p.id, areaId: p.areaId })
    ui.close()
    navigate(`/projects/${p.id}?move=1`)
  }

  return (
    <Modal open={ui.newProject.open} onClose={ui.close} title="New project">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        <Field label="Project name">
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Finish the Becoming Her workbook" />
        </Field>
        <Field label="What am I trying to accomplish?">
          <input className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Optional — I’ll help fill this in" />
        </Field>
        <Field label="Area" hint={!areaId && suggested ? `I’d put this in ${db.areas.find((a) => a.id === suggested)?.name}.` : undefined}>
          <select className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">{suggested ? `Suggested: ${db.areas.find((a) => a.id === suggested)?.name}` : 'Choose an area'}</option>
            {db.areas.filter((a) => a.kind !== 'system').map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {more ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date (optional)">
                <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              <Field label="Rhythm (optional)">
                <select className="input" value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
                  {Object.entries(CADENCE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes (optional)">
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </>
        ) : (
          <button type="button" className="text-xs text-muted underline-offset-4 hover:text-white hover:underline" onClick={() => setMore(true)}>
            + Date, rhythm, notes
          </button>
        )}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-muted">I’ll suggest milestones and first steps next.</p>
          <button className="btn-primary" disabled={!name.trim()}>
            Create project
          </button>
        </div>
      </form>
    </Modal>
  )
}
