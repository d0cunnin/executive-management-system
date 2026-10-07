import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useDB, useEMS } from '../app/EMSContext'

/** Shown while sample data is present, with a one-click way to clear it. */
export function SampleDataBanner() {
  useDB() // re-render when data changes
  const { store } = useEMS()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const count = store.sampleCount()

  if (done !== null && !count) return <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">Cleared {done} sample items. Everything you see now is yours.</p>
  if (!count) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/30 bg-gold/[0.06] px-4 py-3">
      <p className="flex-1 text-sm text-mist">
        You’re looking at <strong className="text-white">sample data</strong> ({count} items) so you can see how EMS works. Clear it when you’re ready to start with your own.
      </p>
      <button
        className="btn-gold shrink-0 py-1.5 text-xs"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm('Remove all sample projects, calendar items, to-dos, income, ideas and notes? Anything you created yourself stays. This can’t be undone.')) return
          setBusy(true)
          setDone(await store.clearSampleData())
          setBusy(false)
        }}
      >
        {busy && <Loader2 size={12} className="animate-spin" />} Clear sample data
      </button>
    </div>
  )
}
