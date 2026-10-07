import { useMemo, useState } from 'react'
import { loadCheck, wellnessSummary } from '../ai/intelligence'
import { useDB, useEMS } from '../app/EMSContext'
import { Field, PageHeader, Panel } from '../components/ui'
import { cn, dayOffset, parseDate, toDateKey } from '../lib/util'

export default function Wellness() {
  const db = useDB()
  const { store } = useEMS()
  const todayKey = toDateKey(new Date())
  const existing = db.wellness.find((w) => w.date === todayKey)
  const [form, setForm] = useState({
    movementMinutes: String(existing?.movementMinutes ?? ''),
    stretched: existing?.stretched ?? false,
    sleepHours: String(existing?.sleepHours ?? ''),
    waterCups: String(existing?.waterCups ?? ''),
    energy: existing?.energy ?? 3,
    note: existing?.note ?? '',
  })
  const [saved, setSaved] = useState(false)
  const sum = useMemo(() => wellnessSummary(db), [db])
  const load = loadCheck(db)
  const week = Array.from({ length: 7 }, (_, i) => dayOffset(i - 6)).map((d) => ({ d, w: db.wellness.find((x) => x.date === d) }))

  function save() {
    const data = {
      date: todayKey,
      movementMinutes: Number(form.movementMinutes) || 0,
      stretched: form.stretched,
      sleepHours: form.sleepHours ? Number(form.sleepHours) : undefined,
      waterCups: form.waterCups ? Number(form.waterCups) : undefined,
      energy: form.energy,
      note: form.note || undefined,
    }
    if (existing) store.update('wellness', existing.id, data)
    else store.create('wellness', data)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div>
      <PageHeader eyebrow="Wellness" title="Taking care of the one doing the work" sub="Movement, rest, and consistency. This is encouragement, never diagnosis — and never about body image." />
      {load && <p className="mb-5 max-w-3xl rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-100">{load}</p>}
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Today’s check-in" className="xl:col-span-1">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Active minutes">
                <input className="input" inputMode="numeric" value={form.movementMinutes} onChange={(e) => setForm({ ...form, movementMinutes: e.target.value })} />
              </Field>
              <Field label="Sleep (hours)">
                <input className="input" inputMode="decimal" value={form.sleepHours} onChange={(e) => setForm({ ...form, sleepHours: e.target.value })} />
              </Field>
              <Field label="Water (cups)">
                <input className="input" inputMode="numeric" value={form.waterCups} onChange={(e) => setForm({ ...form, waterCups: e.target.value })} />
              </Field>
              <label className="flex items-end gap-2 pb-2.5 text-sm text-mist">
                <input type="checkbox" className="h-4 w-4 accent-[#8b7cff]" checked={form.stretched} onChange={(e) => setForm({ ...form, stretched: e.target.checked })} />
                Stretched / mobility
              </label>
            </div>
            <Field label="How is your energy?">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} onClick={() => setForm({ ...form, energy: n })} className={cn('h-9 flex-1 rounded-lg border text-sm', form.energy === n ? 'border-emerald-300/60 bg-emerald-300/15 text-white' : 'border-line text-muted')}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Anything on your mind? (optional)">
              <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <button className="btn-primary w-full justify-center">{saved ? 'Saved' : existing ? 'Update check-in' : 'Save check-in'}</button>
          </form>
        </Panel>

        <div className="space-y-5 xl:col-span-2">
          <Panel title="This week">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                [`${sum.movement}`, 'active minutes'],
                [`${sum.activeDays}/7`, 'days moving'],
                [sum.sleep ? `${sum.sleep}h` : '—', 'average sleep'],
                [sum.water ? `${sum.water}` : '—', 'cups water / day'],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl bg-white/[0.03] px-2 py-3">
                  <p className="display text-2xl text-white">{v}</p>
                  <p className="text-[10px] text-muted">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex h-36 items-end gap-2" role="img" aria-label="Active minutes per day this week">
              {week.map(({ d, w }) => {
                const m = w?.movementMinutes ?? 0
                return (
                  <div key={d} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] text-muted">{m || ''}</span>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-emerald-400/30 to-emerald-300/80" style={{ height: `${Math.max(3, Math.min(100, (m / 60) * 100))}%` }} />
                    <span className="text-[10px] text-muted">{parseDate(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                  </div>
                )
              })}
            </div>
          </Panel>
          <Panel title="Gentle suggestions">
            <ul className="space-y-1.5 text-sm text-mist">
              {sum.activeDays < 4 && <li>• A ten-minute walk between calls counts. Small and consistent wins.</li>}
              {sum.sleep !== null && sum.sleep < 7 && <li>• Rest has been short this week. Protect one earlier night.</li>}
              {sum.water !== null && sum.water < 6 && <li>• Keep water close during writing sessions.</li>}
              {sum.activeDays >= 4 && (sum.sleep ?? 7) >= 7 && <li>• You’re being consistent. Keep it gentle and keep going.</li>}
            </ul>
            <p className="mt-3 text-[11px] text-muted">EMS doesn’t give medical advice. For health concerns, talk with your doctor.</p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
