import { Check, History, Pencil, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDB, useEMS } from '../app/EMSContext'
import { moveContent } from '../data/contentOps'
import { objectiveLabel } from '../domain/content'
import { CHANNEL_LABEL } from '../domain/labels'
import type { ContentItem, ContentStatus } from '../domain/types'
import { cn, friendlyDate } from '../lib/util'
import { AGENT_NAMES, ContentStatusBadge, useActor } from './studio'

/** A content draft in the approval queue, with every action wired to real behavior. */
/** onResult reports outcomes to the page, because the card moves lists (or disappears) once its status changes. */
export function ContentApprovalCard({ item, onResult }: { item: ContentItem; onResult?: (r: { ok: boolean; text: string }) => void }) {
  const db = useDB()
  const { store } = useEMS()
  const actor = useActor()
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const campaign = item.campaignId ? db.campaigns.find((c) => c.id === item.campaignId) : undefined
  const area = db.areas.find((a) => a.id === (item.areaId ?? campaign?.areaId))

  const go = async (to: ContentStatus, why?: string) => {
    setBusy(true)
    const r = await moveContent(store, item.id, to, { role: actor.role, by: actor.name, reason: why })
    setBusy(false)
    const result = r.ok
      ? { ok: true, text: `“${item.title}”: ${to === 'approved' ? 'Approved. Nothing has been scheduled or posted.' : to === 'changes_requested' ? 'Sent back with your note.' : 'Returned to draft.'}` }
      : { ok: false, text: r.error }
    setMsg(result)
    onResult?.(result)
    if (r.ok) setAsking(false)
  }

  const facts: [string, string | undefined][] = [
    ['Initiative', area?.name],
    ['Campaign', campaign?.name],
    ['Type', item.kind],
    ['Platform', item.channel ? CHANNEL_LABEL[item.channel] : undefined],
    ['Audience', item.audience ?? campaign?.audience],
    ['Objective', campaign ? objectiveLabel(campaign.objective) : undefined],
    ['Planned date', item.publishDate ? friendlyDate(item.publishDate) : undefined],
    ['Call to action', item.cta],
    ['Drafted by', item.createdByAgent ? `${AGENT_NAMES[item.createdByAgent] ?? item.createdByAgent}${item.engine === 'ai' ? ' (AI)' : item.engine === 'builtin' ? ' (template)' : ''}` : item.owner],
    ['Last updated', `${new Date(item.updatedAt).toLocaleDateString()}${item.updatedBy ? ` by ${item.updatedBy}` : ''}`],
  ]

  return (
    <article className={cn('rounded-xl border p-3.5', item.status === 'needs_review' ? 'border-gold/30 bg-gold/[0.04]' : 'border-line bg-ink-950/30')}>
      <header className="flex flex-wrap items-start gap-2">
        <Link to={`/studio/content/${item.id}`} className="mr-auto text-sm font-medium text-white hover:underline">
          {item.title || 'Untitled draft'}
        </Link>
        <ContentStatusBadge status={item.status} />
      </header>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="inline text-muted">{k}: </dt>
            <dd className={cn('inline', v ? 'text-mist' : 'text-amber-300/90')}>{v ?? 'not set'}</dd>
          </div>
        ))}
      </dl>
      {item.body && <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded-lg bg-ink-950/50 p-2 text-xs text-mist">{item.body}</p>}
      {(item.media ?? []).length > 0 && (
        <p className="mt-1 text-[11px] text-muted">
          Media:{' '}
          {item.media!.map((m, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {m.url ? (
                <a className="text-glow hover:underline" href={m.url} target="_blank" rel="noreferrer">
                  {m.label || 'link'}
                </a>
              ) : (
                m.label
              )}
            </span>
          ))}
        </p>
      )}
      {item.changesRequestedReason && item.status === 'changes_requested' && <p className="mt-1 text-xs text-rose-200">Requested: {item.changesRequestedReason}</p>}

      {asking && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-muted" htmlFor={`reason_${item.id}`}>
            What should change?
          </label>
          <textarea id={`reason_${item.id}`} autoFocus className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary py-1.5 text-xs" disabled={busy} onClick={() => go('changes_requested', reason)}>
              Send back
            </button>
            <button className="btn-ghost py-1.5 text-xs" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p role="status" className={cn('mt-2 text-xs', msg.ok ? 'text-emerald-300' : 'text-amber-200')}>
          {msg.text}
        </p>
      )}

      <footer className="mt-3 flex flex-wrap gap-2">
        <Link to={`/studio/content/${item.id}`} className="btn-ghost py-1.5 text-xs">
          <Pencil size={13} /> Open & edit
        </Link>
        {item.status === 'needs_review' && actor.canApprove && (
          <>
            <button className="btn-gold py-1.5 text-xs" disabled={busy} onClick={() => go('approved')}>
              <Check size={13} /> Approve
            </button>
            {!asking && (
              <button className="btn-ghost py-1.5 text-xs" disabled={busy} onClick={() => setAsking(true)}>
                <X size={13} /> Request changes
              </button>
            )}
          </>
        )}
        {(item.status === 'needs_review' || item.status === 'changes_requested') && actor.canEdit && (
          <button className="btn-ghost py-1.5 text-xs" disabled={busy} onClick={() => go('draft')}>
            <RotateCcw size={13} /> Return to draft
          </button>
        )}
        <Link to={`/studio/content/${item.id}?history=1`} className="btn-ghost py-1.5 text-xs">
          <History size={13} /> Revision history
        </Link>
      </footer>
      {item.status === 'needs_review' && !actor.canApprove && (
        <p className="mt-2 text-[11px] text-muted">{actor.roleError ? 'Approving is off until approval roles are set up.' : 'Only an owner or approver can approve this.'}</p>
      )}
    </article>
  )
}
