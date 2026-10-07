import { Check, Copy, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { executeAction } from '../ai/skills'
import { useDB, useEMS } from '../app/EMSContext'
import { ACTION_STATE_LABEL } from '../domain/labels'
import type { AIAction } from '../domain/types'
import { cn } from '../lib/util'

/** One piece of AI work, with the approval flow: Draft → Needs approval → Approved → Done. */
export function ActionCard({ action, compact }: { action: AIAction; compact?: boolean }) {
  const { store } = useEMS()
  const db = useDB()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(action.output ?? '')
  const [copied, setCopied] = useState(false)
  const agent = db.agents.find((a) => a.key === action.agentKey)
  const pending = action.state === 'needs_approval' || action.state === 'draft'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(action.output ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked; the text is visible to select by hand.
    }
  }

  return (
    <article className={cn('rounded-xl border p-3.5', action.state === 'needs_approval' ? 'border-gold/30 bg-gold/[0.04]' : 'border-line bg-ink-950/30')}>
      <header className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-medium text-white">{action.title}</p>
        <span className={cn('chip', action.engine === 'ai' ? 'text-emerald-300' : 'text-muted')} title={action.summary}>
          {action.engine === 'ai' ? 'AI draft' : 'Built-in template'}
        </span>
        <span className={cn('chip', action.state === 'needs_approval' && 'text-gold border-gold/40', action.state === 'executed' && 'text-emerald-300')}>{ACTION_STATE_LABEL[action.state]}</span>
      </header>
      <p className="mt-1 text-xs text-muted">
        {agent?.name ?? 'Assistant'} · {action.summary}
      </p>
      {!compact &&
        (editing ? (
          <textarea className="input mt-3 min-h-40 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
        ) : (
          action.output && <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-950/50 p-3 font-sans text-xs leading-relaxed text-mist">{action.output}</pre>
        ))}
      {action.executedNote && <p className="mt-2 text-xs text-emerald-300/90">{action.executedNote}</p>}
      <footer className="mt-3 flex flex-wrap gap-2">
        {pending && editing && (
          <button
            className="btn-ghost py-1.5 text-xs"
            onClick={() => {
              store.update('actions', action.id, { output: text })
              setEditing(false)
            }}
          >
            Save edits
          </button>
        )}
        {pending && !editing && !compact && (
          <button className="btn-ghost py-1.5 text-xs" onClick={() => setEditing(true)}>
            <Pencil size={13} /> Edit
          </button>
        )}
        {action.state === 'needs_approval' && (
          <button className="btn-gold py-1.5 text-xs" onClick={() => executeAction(store, store.get('actions', action.id)!)}>
            <Check size={13} /> Approve
          </button>
        )}
        {action.state === 'draft' && (
          <button className="btn-primary py-1.5 text-xs" onClick={() => executeAction(store, store.get('actions', action.id)!)}>
            <Check size={13} /> Use this
          </button>
        )}
        {pending && (
          <button className="btn-ghost py-1.5 text-xs" onClick={() => store.update('actions', action.id, { state: 'declined' })}>
            <X size={13} /> Decline
          </button>
        )}
        {action.output && (
          <button className="btn-ghost py-1.5 text-xs" onClick={copy}>
            <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </footer>
    </article>
  )
}
