import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SKILLS, runSkill } from '../ai/skills'
import { useDB, useEMS } from '../app/EMSContext'
import { PageHeader, Panel } from '../components/ui'
import { cn } from '../lib/util'

const REPORTS = [
  { key: 'daily_brief', label: 'Daily brief' },
  { key: 'weekly_review', label: 'Weekly review' },
  { key: 'monthly_review', label: 'Monthly review' },
  { key: 'quarterly_review', label: 'Quarterly review' },
] as const

export default function Reviews() {
  const db = useDB()
  const { store, ai } = useEMS()
  const [which, setWhich] = useState<(typeof REPORTS)[number]['key']>('daily_brief')
  const [saving, setSaving] = useState(false)
  // Always computed live from current data.
  const text = useMemo(() => SKILLS[which].template({ db }), [db, which])
  const saved = db.actions.filter((a) => REPORTS.some((r) => r.key === a.skill)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)

  return (
    <div>
      <PageHeader eyebrow="Briefs & Reviews" title="The view from above" sub="Built live from what’s in EMS — so it’s always current. Save one to keep a record." />
      <div className="mb-5 flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button key={r.key} className={cn('btn-ghost', which === r.key && 'border-glow/60 bg-glow/10 text-white')} onClick={() => setWhich(r.key)}>
            {r.label}
          </button>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Panel
          title={REPORTS.find((r) => r.key === which)!.label}
          action={
            <button
              className="btn-primary py-1.5 text-xs"
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                await runSkill(store, ai, { skill: which, agentKey: 'executive', title: `${REPORTS.find((r) => r.key === which)!.label} — ${new Date().toLocaleDateString()}` })
                setSaving(false)
              }}
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {ai.connected ? 'Have AI write it up' : 'Save a copy'}
            </button>
          }
        >
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-mist">{text}</pre>
        </Panel>
        <Panel title="Saved">
          {saved.length ? (
            <ul className="space-y-1.5 text-sm">
              {saved.map((a) => (
                <li key={a.id} className="text-mist">
                  {a.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing saved yet. Saved copies also appear in My AI Team.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
