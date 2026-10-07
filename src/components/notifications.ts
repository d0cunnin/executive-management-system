import { comingUp, needsAttention, waitingOn, wellnessSummary } from '../ai/intelligence'
import type { DB } from '../domain/types'
import { friendlyDate, timeOf } from '../lib/util'

export interface Notice {
  key: string
  kind: 'approval' | 'attention' | 'upcoming' | 'waiting' | 'wellness' | 'next'
  title: string
  body: string
  href: string
}

/**
 * Derived from live data so nothing goes stale. Capped and filtered so only
 * things that matter surface.
 */
export function notices(db: DB): Notice[] {
  const out: Notice[] = []
  const approvals = db.actions.filter((a) => a.state === 'needs_approval')
  if (approvals.length) out.push({ key: 'approvals', kind: 'approval', title: `${approvals.length} item${approvals.length === 1 ? '' : 's'} need your approval`, body: approvals[0].title, href: '/team' })
  for (const a of needsAttention(db).filter((a) => a.severity === 3).slice(0, 3)) out.push({ key: `att_${a.key}`, kind: 'attention', title: a.title, body: a.why, href: a.href })
  for (const e of comingUp(db, 1).filter((e) => e.kind !== 'wellness').slice(0, 2)) out.push({ key: `ev_${e.id}`, kind: 'upcoming', title: e.title, body: `${friendlyDate(e.start)} ${timeOf(e.start)}`.trim(), href: '/calendar' })
  const longWait = waitingOn(db).filter((w) => w.days >= 7)[0]
  if (longWait) out.push({ key: `w_${longWait.id}`, kind: 'waiting', title: `Still waiting on ${longWait.waitingOn}`, body: `${longWait.title} · ${longWait.days} days`, href: longWait.projectId ? `/projects/${longWait.projectId}` : '/tasks' })
  const w = wellnessSummary(db)
  if (!w.today && new Date().getHours() >= 15) out.push({ key: 'well', kind: 'wellness', title: 'A quick wellness check-in?', body: 'Thirty seconds. Movement, water, rest.', href: '/wellness' })
  return out.slice(0, 7)
}
