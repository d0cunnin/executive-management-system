import { ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isOpen, needsAttention } from '../ai/intelligence'
import { useDB } from '../app/EMSContext'
import { PageHeader, Panel } from '../components/ui'
import type { Area, DB } from '../domain/types'
import { areaHref } from '../lib/routes'
import { cn, money } from '../lib/util'

const W = 1000
const H = 720
const CX = W / 2
const CY = H / 2

function areaStats(db: DB, a: Area) {
  const projects = db.projects.filter((p) => p.areaId === a.id && isOpen(p))
  const attention = needsAttention(db).filter((n) => projects.some((p) => p.id === n.key))
  const income = db.income.filter((i) => i.areaId === a.id && i.certainty === 'actual').reduce((s, i) => s + i.amount, 0)
  const ideas = db.ideas.filter((i) => i.areaId === a.id && i.status !== 'let_go' && i.status !== 'became_project').length
  return { projects, attention, income, ideas }
}

/** How an area's work connects: material → offers → income, via stored links. */
function chain(db: DB, a: Area): string[] {
  const assets = db.assets.filter((x) => x.areaId === a.id)
  const steps: string[] = [a.name]
  if (assets.length) steps.push(assets.slice(0, 2).map((x) => x.title).join(' + '))
  const linkedIds = new Set(db.links.filter((l) => assets.some((x) => x.id === l.fromId)).map((l) => l.toId))
  const offers = db.offers.filter((o) => linkedIds.has(o.id) || o.areaId === a.id)
  const campaigns = db.campaigns.filter((c) => c.areaId === a.id)
  if (campaigns.length) steps.push(`${campaigns[0].name} campaign`)
  const content = db.content.filter((c) => c.areaId === a.id)
  if (content.length) steps.push('Content')
  if (offers.length) steps.push(offers.slice(0, 2).map((o) => o.name).join(' + '))
  const ideas = db.ideas.filter((i) => linkedIds.has(i.id))
  if (ideas.length) steps.push(`Idea: ${ideas[0].title}`)
  if (db.income.some((i) => i.areaId === a.id)) steps.push('Income')
  return steps
}

export default function CommandCenter() {
  const db = useDB()
  const navigate = useNavigate()
  const [focus, setFocus] = useState<string | null>(null)

  const nodes = useMemo(() => {
    const n = db.areas.length
    return db.areas.map((a, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 285 : 245
      const stats = areaStats(db, a)
      return { a, x: CX + Math.cos(angle) * r * 1.25, y: CY + Math.sin(angle) * r, stats, size: 16 + Math.min(14, stats.projects.length * 4) }
    })
  }, [db])
  const byId = Object.fromEntries(nodes.map((n) => [n.a.id, n]))
  const edges = useMemo(() => {
    const seen = new Set<string>()
    const out: { from: string; to: string }[] = []
    for (const n of nodes)
      for (const to of n.a.connectedAreaIds) {
        const k = [n.a.id, to].sort().join('|')
        if (!seen.has(k) && byId[to]) {
          seen.add(k)
          out.push({ from: n.a.id, to })
        }
      }
    return out
  }, [nodes, byId])

  const focused = nodes.find((n) => n.a.id === focus) ?? null
  const isLinked = (id: string) => !focus || id === focus || focused?.a.connectedAreaIds.includes(id) || byId[id]?.a.connectedAreaIds.includes(focus)

  return (
    <div>
      <PageHeader eyebrow="Command Center" title="How your work connects" sub="Every area of your world and how they feed each other. Select an area to see its state; open it to go inside." />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="glass relative overflow-hidden p-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Map of D’Andrea’s areas">
            <defs>
              <radialGradient id="core" cx="50%" cy="45%">
                <stop offset="0" stopColor="#c4b5fd" />
                <stop offset="0.6" stopColor="#7c5cff" />
                <stop offset="1" stopColor="#3b2a9e" />
              </radialGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* orbit rings */}
            {[150, 250, 330].map((r) => (
              <ellipse key={r} cx={CX} cy={CY} rx={r * 1.25} ry={r} fill="none" stroke="rgb(165 160 255 / 0.07)" strokeDasharray="2 6" />
            ))}
            {/* spokes */}
            {nodes.map((n) => (
              <line key={`s_${n.a.id}`} x1={CX} y1={CY} x2={n.x} y2={n.y} stroke={n.a.color} strokeOpacity={isLinked(n.a.id) ? 0.22 : 0.05} strokeWidth={1} />
            ))}
            {/* area-to-area relationships */}
            {edges.map((e) => {
              const f = byId[e.from]
              const t = byId[e.to]
              const active = focus && (e.from === focus || e.to === focus)
              const mx = (f.x + t.x) / 2 + (CX - (f.x + t.x) / 2) * 0.45
              const my = (f.y + t.y) / 2 + (CY - (f.y + t.y) / 2) * 0.45
              return (
                <path
                  key={`${e.from}_${e.to}`}
                  d={`M${f.x},${f.y} Q${mx},${my} ${t.x},${t.y}`}
                  fill="none"
                  stroke={active ? '#e8c77a' : '#8b7cff'}
                  strokeOpacity={active ? 0.9 : focus ? 0.06 : 0.28}
                  strokeWidth={active ? 2 : 1.2}
                  strokeDasharray={active ? '6 6' : undefined}
                >
                  {active && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1.2s" repeatCount="indefinite" />}
                </path>
              )
            })}
            {/* core */}
            <g filter="url(#glow)">
              <circle cx={CX} cy={CY} r={58} fill="url(#core)" />
            </g>
            <circle cx={CX} cy={CY} r={58} fill="none" stroke="#c4b5fd" strokeOpacity="0.5">
              <animate attributeName="r" values="58;78;58" dur="5s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="5s" repeatCount="indefinite" />
            </circle>
            <text x={CX} y={CY - 6} textAnchor="middle" className="fill-white font-display" fontSize="20" fontWeight="700">
              D’ANDREA BOLDEN
            </text>
            <text x={CX} y={CY + 16} textAnchor="middle" fill="#e9e5ff" fontSize="12" letterSpacing="4">
              EMS
            </text>
            {/* area nodes */}
            {nodes.map((n) => {
              const hot = n.stats.attention.length > 0
              return (
                <g
                  key={n.a.id}
                  className="cursor-pointer"
                  opacity={isLinked(n.a.id) ? 1 : 0.3}
                  onMouseEnter={() => setFocus(n.a.id)}
                  onFocus={() => setFocus(n.a.id)}
                  onClick={() => (focus === n.a.id ? navigate(areaHref(n.a)) : setFocus(n.a.id))}
                  onDoubleClick={() => navigate(areaHref(n.a))}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.a.name}: ${n.stats.projects.length} open projects${hot ? ', needs attention' : ''}`}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(areaHref(n.a))}
                >
                  {hot && (
                    <circle cx={n.x} cy={n.y} r={n.size + 8} fill="none" stroke="#fbbf24" strokeOpacity="0.7">
                      <animate attributeName="r" values={`${n.size + 4};${n.size + 14};${n.size + 4}`} dur="2.4s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={n.x} cy={n.y} r={n.size} fill="#0d0b26" stroke={n.a.color} strokeWidth={focus === n.a.id ? 3 : 1.6} />
                  <circle cx={n.x} cy={n.y} r={n.size * 0.42} fill={n.a.color} opacity={0.9} filter="url(#glow)" />
                  <text x={n.x} y={n.y + n.size + 18} textAnchor="middle" fill="#ffffff" fontSize="13.5" fontWeight="500">
                    {n.a.name}
                  </text>
                  <text x={n.x} y={n.y + n.size + 33} textAnchor="middle" fill="#8f8bc0" fontSize="11">
                    {n.stats.projects.length ? `${n.stats.projects.length} open` : n.a.kind === 'system' ? '' : 'steady'}
                    {hot ? ' · needs attention' : ''}
                  </text>
                </g>
              )
            })}
          </svg>
          <p className="absolute bottom-3 left-4 text-[11px] text-muted">Tap an area to see it · tap again to open · amber pulse = needs attention</p>
        </div>

        <div className="space-y-5">
          {focused ? (
            <Panel title={focused.a.name}>
              <p className="text-sm text-muted">{focused.a.tagline}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/[0.03] p-2">
                  <dt className="text-[10px] text-muted">Open projects</dt>
                  <dd className="display text-2xl text-white">{focused.stats.projects.length}</dd>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-2">
                  <dt className="text-[10px] text-muted">Needs attention</dt>
                  <dd className={cn('display text-2xl', focused.stats.attention.length ? 'text-amber-300' : 'text-white')}>{focused.stats.attention.length}</dd>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-2">
                  <dt className="text-[10px] text-muted">Received</dt>
                  <dd className="display text-2xl text-gold">{money(focused.stats.income)}</dd>
                </div>
              </dl>
              {focused.stats.attention[0] && <p className="mt-3 text-xs text-amber-200">{focused.stats.attention[0].title}: {focused.stats.attention[0].why}</p>}
              <p className="label mt-5 mb-2">How it connects</p>
              <ol className="space-y-1.5">
                {chain(db, focused.a).map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-mist">
                    {i > 0 && <ArrowRight size={12} className="text-glow" />}
                    <span className={i === 0 ? 'font-medium text-white' : ''}>{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted">
                Feeds: {focused.a.connectedAreaIds.map((id) => byId[id]?.a.name).filter(Boolean).join(', ') || '—'}
              </p>
              <div className="mt-5 flex gap-2">
                <Link to={areaHref(focused.a)} className="btn-primary">
                  Open
                </Link>
                {focused.a.kind !== 'system' && (
                  <Link to={`${areaHref(focused.a)}?move=1`} className="btn-ghost">
                    Move this forward
                  </Link>
                )}
              </div>
            </Panel>
          ) : (
            <Panel title="Your world at a glance">
              <ul className="space-y-1">
                {nodes
                  .slice()
                  .sort((x, y) => y.stats.attention.length - x.stats.attention.length || y.stats.projects.length - x.stats.projects.length)
                  .map((n) => (
                    <li key={n.a.id}>
                      <button className="row w-full text-left" onClick={() => setFocus(n.a.id)}>
                        <span className="mt-1.5 h-2 w-2 rounded-full" style={{ background: n.a.color }} />
                        <span className="flex-1 text-sm text-white">{n.a.name}</span>
                        {n.stats.attention.length > 0 && <span className="chip text-amber-300">{n.stats.attention.length}</span>}
                      </button>
                    </li>
                  ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
