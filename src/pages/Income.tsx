import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { areaOf, incomeSummary, monetizationScan } from '../ai/intelligence'
import { useDB, useEMS } from '../app/EMSContext'
import { AreaTag, Calm, DemoTag, Field, Modal, PageHeader, Panel } from '../components/ui'
import { CERTAINTY_LABEL } from '../domain/labels'
import type { IncomeCertainty, IncomeEntry } from '../domain/types'
import { cn, friendlyDate, money, toDateKey } from '../lib/util'

const CERTAINTY_NOTE: Record<IncomeCertainty, string> = {
  actual: 'Money received.',
  expected: 'Committed but not yet received.',
  forecast: 'Likely, based on a plan. Not guaranteed.',
  estimate: 'A rough guess. Not guaranteed.',
}

export default function Income() {
  const db = useDB()
  const { store } = useEMS()
  const sum = useMemo(() => incomeSummary(db), [db])
  const scan = useMemo(() => monetizationScan(db), [db])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ label: '', amount: '', certainty: 'actual' as IncomeCertainty, date: toDateKey(new Date()), areaId: '', source: 'other' as IncomeEntry['source'] })

  const bySource = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of db.income.filter((x) => x.certainty === 'actual')) m.set(i.source, (m.get(i.source) ?? 0) + i.amount)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [db])
  const maxSource = Math.max(1, ...bySource.map(([, v]) => v))

  return (
    <div>
      <PageHeader
        eyebrow="Income"
        title="What is making money — and what could"
        sub="Received money is kept separate from everything that hasn’t arrived yet. Estimates are never treated as guaranteed."
        actions={
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={15} /> Record income
          </button>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ['Received · 90 days', sum.receivedLast90, 'actual'],
            ['Expected', sum.expected, 'expected'],
            ['Forecast', sum.forecast, 'forecast'],
            ['Estimates', sum.estimate, 'estimate'],
          ] as const
        ).map(([label, v, c]) => (
          <div key={label} className={cn('glass p-4', c === 'actual' && 'border-gold/30')}>
            <p className="label">{label}</p>
            <p className={cn('display mt-1 text-3xl', c === 'actual' ? 'text-gold' : c === 'expected' ? 'text-white' : 'text-muted')}>{money(v)}</p>
            <p className="mt-1 text-[11px] text-muted">{CERTAINTY_NOTE[c]}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Panel title="All income">
            <ul className="-mx-3">
              {db.income
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((i) => (
                  <li key={i.id} className="row items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{i.label}</p>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                        <AreaTag area={areaOf(db, i.areaId)} />
                        <span>{friendlyDate(i.date)}</span>
                        <span>{i.source}</span>
                        <DemoTag show={i.demo} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-medium', i.certainty === 'actual' ? 'text-gold' : 'text-mist')}>{money(i.amount)}</p>
                      <select
                        className="bg-transparent text-[11px] text-muted"
                        value={i.certainty}
                        onChange={(e) => store.update('income', i.id, { certainty: e.target.value as IncomeCertainty })}
                        aria-label="Certainty"
                      >
                        {Object.entries(CERTAINTY_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
            </ul>
          </Panel>

          <Panel title="Offers" hint="What you sell or could sell.">
            <div className="grid gap-3 sm:grid-cols-2">
              {db.offers.map((o) => (
                <div key={o.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{o.name}</p>
                    <span className={cn('chip', o.status === 'live' && 'text-emerald-300')}>{o.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {o.kind}
                    {o.price ? ` · ${money(o.price)}` : ''}
                  </p>
                  <AreaTag area={areaOf(db, o.areaId)} />
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Received, by source">
            {bySource.length ? (
              <ul className="space-y-2.5">
                {bySource.map(([s, v]) => (
                  <li key={s}>
                    <div className="flex justify-between text-xs">
                      <span className="capitalize text-mist">{s}</span>
                      <span className="text-gold">{money(v)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gold/70" style={{ width: `${(v / maxSource) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Calm>No income received yet.</Calm>
            )}
          </Panel>
          <Panel title="Income you could unlock" hint="From what you already have.">
            {scan.length ? (
              <ul className="space-y-3">
                {scan.slice(0, 5).map((m) => (
                  <li key={m.assetId}>
                    <p className="text-sm text-white">{m.asset}</p>
                    <p className="text-xs text-muted">{m.options.slice(0, 3).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Calm />
            )}
            <Link to="/ideas" className="mt-3 inline-block text-xs text-glow hover:underline">
              Explore in Ideas & Opportunities →
            </Link>
          </Panel>
        </div>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Record income">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            const amount = Number(form.amount)
            if (!form.label || !amount) return
            store.create('income', { label: form.label, amount, certainty: form.certainty, date: form.date, areaId: form.areaId || undefined, source: form.source })
            if (form.certainty === 'actual') store.logProgress({ kind: 'income', title: `${money(amount)} received — ${form.label}`, areaId: form.areaId || undefined })
            setAdding(false)
            setForm({ ...form, label: '', amount: '' })
          }}
        >
          <Field label="What for">
            <input autoFocus className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount ($)">
              <input className="input" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Date">
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="How certain is it?" hint={CERTAINTY_NOTE[form.certainty]}>
            <select className="input" value={form.certainty} onChange={(e) => setForm({ ...form, certainty: e.target.value as IncomeCertainty })}>
              {Object.entries(CERTAINTY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="Source">
              <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as IncomeEntry['source'] })}>
                {['course', 'book', 'event', 'speaking', 'service', 'product', 'grant', 'donation', 'sponsorship', 'membership', 'other'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
