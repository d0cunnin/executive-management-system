// Global keyword search across every collection. Ranked by where the match
// lands (title beats body). Semantic search can replace `score` later without
// changing callers.
import { ENTITY_LABEL } from '../domain/labels'
import type { DB, EntityType } from '../domain/types'

export interface SearchHit {
  type: EntityType
  typeLabel: string
  id: string
  title: string
  sub?: string
  href: string
  score: number
}

function score(q: string, title: string, body = ''): number {
  const t = title.toLowerCase()
  const b = body.toLowerCase()
  const words = q.split(/\s+/).filter(Boolean)
  if (!words.every((w) => t.includes(w) || b.includes(w))) return 0
  let s = 0
  if (t.startsWith(q)) s += 50
  if (t.includes(q)) s += 30
  for (const w of words) s += t.includes(w) ? 10 : 2
  return s
}

export function search(db: DB, raw: string): SearchHit[] {
  const q = raw.trim().toLowerCase()
  if (!q) return []
  const area = (id?: string) => db.areas.find((a) => a.id === id)?.name
  const hits: SearchHit[] = []
  const add = (type: EntityType, id: string, title: string, body: string | undefined, href: string, sub?: string) => {
    const s = score(q, title, body)
    if (s) hits.push({ type, typeLabel: ENTITY_LABEL[type], id, title, sub, href, score: s })
  }
  for (const a of db.areas) add('area', a.id, a.name, `${a.tagline} ${a.focuses.join(' ')}`, `/areas/${a.slug}`, a.tagline)
  for (const p of db.projects) add('project', p.id, p.name, `${p.outcome} ${p.notes ?? ''}`, `/projects/${p.id}`, area(p.areaId))
  for (const t of db.tasks) add('task', t.id, t.title, t.waitingOn, t.projectId ? `/projects/${t.projectId}` : '/tasks', area(t.areaId))
  for (const o of db.ongoing) add('ongoing', o.id, o.title, o.notes, `/areas/${db.areas.find((a) => a.id === o.areaId)?.slug}`, area(o.areaId))
  for (const g of db.goals) add('goal', g.id, g.title, g.metric, `/areas/${db.areas.find((a) => a.id === g.areaId)?.slug}`, area(g.areaId))
  for (const c of db.campaigns) add('campaign', c.id, c.name, `${c.objective} ${c.audience ?? ''} ${c.message ?? ''}`, c.projectId ? `/projects/${c.projectId}` : '/work', area(c.areaId))
  for (const e of db.events) add('event', e.id, e.title, e.notes, '/calendar', area(e.areaId))
  for (const i of db.ideas) add('idea', i.id, i.title, i.description, '/ideas', area(i.areaId))
  for (const i of db.income) add('income', i.id, i.label, i.source, '/income', `${i.certainty} · $${i.amount}`)
  for (const o of db.offers) add('offer', o.id, o.name, o.description, '/income', o.kind)
  for (const c of db.content) add('content', c.id, c.title, c.body, '/information', c.status)
  for (const a of db.assets) add('asset', a.id, a.title, a.description, '/information', a.kind.replace('_', ' '))
  for (const c of db.contacts) add('contact', c.id, c.name, `${c.role ?? ''} ${c.organization ?? ''} ${c.notes ?? ''}`, '/information', c.role)
  for (const n of db.notes) add('note', n.id, n.title, n.body, '/information', n.kind)
  return hits.sort((a, b) => b.score - a.score)
}
