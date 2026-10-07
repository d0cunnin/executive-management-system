import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDB, useEMS } from '../app/EMSContext'
import { AreaTag, Field, Modal, PageHeader, Panel } from '../components/ui'
import type { EventKind } from '../domain/types'
import { cn, parseDate, startOfDay, timeOf, toDateKey } from '../lib/util'

const KIND_COLOR: Record<EventKind, string> = {
  appointment: '#f0abfc',
  meeting: '#818cf8',
  event: '#c084fc',
  deadline: '#fb7185',
  milestone: '#e8c77a',
  campaign: '#38bdf8',
  personal: '#f0abfc',
  wellness: '#86efac',
  launch: '#facc15',
}

export default function CalendarPage() {
  const db = useDB()
  const { store } = useEMS()
  const [cursor, setCursor] = useState(() => {
    const d = startOfDay()
    d.setDate(1)
    return d
  })
  const [selected, setSelected] = useState(toDateKey(new Date()))
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', kind: 'meeting' as EventKind, date: '', time: '', areaId: '' })

  // Calendar items: real events plus project dates and milestone dates.
  const items = useMemo(() => {
    const list = db.events.map((e) => ({ id: e.id, title: e.title, kind: e.kind, start: e.start, areaId: e.areaId }))
    for (const p of db.projects) if (p.dueDate && !db.events.some((e) => e.projectId === p.id && e.kind === 'deadline')) list.push({ id: `pd_${p.id}`, title: `${p.name} — date`, kind: 'deadline', start: p.dueDate, areaId: p.areaId })
    for (const m of db.milestones) if (m.dueDate && !m.done) list.push({ id: `ms_${m.id}`, title: m.title, kind: 'milestone', start: m.dueDate, areaId: db.projects.find((p) => p.id === m.projectId)?.areaId })
    return list
  }, [db])

  const byDay = useMemo(() => {
    const map = new Map<string, typeof items>()
    for (const i of items) {
      const k = toDateKey(parseDate(i.start))
      map.set(k, [...(map.get(k) ?? []), i])
    }
    for (const v of map.values()) v.sort((a, b) => a.start.localeCompare(b.start))
    return map
  }, [items])

  const days = useMemo(() => {
    const first = new Date(cursor)
    first.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(first)
      d.setDate(first.getDate() + i)
      return d
    })
  }, [cursor])

  const todayKey = toDateKey(new Date())
  const dayItems = byDay.get(selected) ?? []

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title={cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        sub="Appointments, meetings, events, deadlines, milestones, campaigns, and wellness — together. Calendar sync is not connected yet; items live in EMS."
        actions={
          <>
            <button className="btn-ghost px-2.5" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <button className="btn-ghost" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
              Today
            </button>
            <button className="btn-ghost px-2.5" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setForm({ title: '', kind: 'meeting', date: selected, time: '', areaId: '' })
                setAdding(true)
              }}
            >
              <Plus size={15} /> Add
            </button>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="glass overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-line text-center text-[11px] text-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const k = toDateKey(d)
              const list = byDay.get(k) ?? []
              const inMonth = d.getMonth() === cursor.getMonth()
              return (
                <button
                  key={k}
                  onClick={() => setSelected(k)}
                  className={cn(
                    'min-h-16 border-b border-r border-line p-1.5 text-left align-top transition-colors sm:min-h-24',
                    !inMonth && 'opacity-35',
                    selected === k ? 'bg-glow/10' : 'hover:bg-white/[0.03]',
                  )}
                >
                  <span className={cn('inline-grid h-6 w-6 place-items-center rounded-full text-xs', k === todayKey ? 'bg-glow text-white' : 'text-mist')}>{d.getDate()}</span>
                  <div className="mt-1 hidden space-y-0.5 sm:block">
                    {list.slice(0, 3).map((i) => (
                      <p key={i.id} className="truncate rounded px-1 text-[10px] text-white" style={{ background: `${KIND_COLOR[i.kind]}26`, borderLeft: `2px solid ${KIND_COLOR[i.kind]}` }}>
                        {i.title}
                      </p>
                    ))}
                    {list.length > 3 && <p className="text-[10px] text-muted">+{list.length - 3} more</p>}
                  </div>
                  <div className="mt-1 flex gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((i) => (
                      <span key={i.id} className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_COLOR[i.kind] }} />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        <Panel title={parseDate(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}>
          {dayItems.length ? (
            <ul className="space-y-3">
              {dayItems.map((i) => (
                <li key={i.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_COLOR[i.kind] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">{i.title}</p>
                    <p className="text-xs text-muted">
                      {i.kind}
                      {timeOf(i.start) && ` · ${timeOf(i.start)}`}
                    </p>
                    <AreaTag area={db.areas.find((a) => a.id === i.areaId)} />
                  </div>
                  {!i.id.startsWith('pd_') && !i.id.startsWith('ms_') && (
                    <button className="text-xs text-muted hover:text-rose-300" onClick={() => window.confirm(`Remove “${i.title}”?`) && store.remove('events', i.id)} aria-label={`Remove ${i.title}`}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing scheduled. Open space is good.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {Object.entries(KIND_COLOR).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                {k}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add to calendar">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.title || !form.date) return
            const start = form.time ? new Date(`${form.date}T${form.time}`).toISOString() : form.date
            store.create('events', { title: form.title, kind: form.kind, start, allDay: !form.time, areaId: form.areaId || undefined })
            setSelected(form.date)
            setAdding(false)
          }}
        >
          <Field label="What">
            <input autoFocus className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Time (optional)">
              <input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EventKind })}>
                {Object.keys(KIND_COLOR).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            <Field label="Area">
              <select className="input" value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
                <option value="">None</option>
                {db.areas.filter((a) => a.kind !== 'system').map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary">Add</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
