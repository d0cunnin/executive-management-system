import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDB } from '../app/EMSContext'
import { useUI } from '../app/UIContext'
import { search, type SearchHit } from '../lib/search'
import { cn } from '../lib/util'

export function CommandPalette() {
  const ui = useUI()
  const db = useDB()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (ui.search) {
      setQ('')
      setIdx(0)
    }
  }, [ui.search])

  const hits = useMemo(() => search(db, q).slice(0, 30), [db, q])
  const go = (h: SearchHit) => {
    ui.close()
    navigate(h.href)
  }
  if (!ui.search) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/70 p-4 pt-[10vh] backdrop-blur-sm" onMouseDown={ui.close}>
      <div className="glass rise w-full max-w-xl overflow-hidden p-0" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="text-muted" />
          <input
            autoFocus
            className="w-full bg-transparent py-4 text-white outline-none placeholder:text-muted"
            placeholder="Projects, people, books, ideas, income…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setIdx(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, hits.length))
              if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0))
              if (e.key === 'Enter') {
                if (idx < hits.length && hits[idx]) go(hits[idx])
                else if (q.trim()) {
                  ui.close()
                  navigate(`/information?q=${encodeURIComponent(q)}`)
                }
              }
              if (e.key === 'Escape') ui.close()
            }}
          />
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {q && !hits.length && <li className="p-3 text-sm text-muted">Nothing found for “{q}”.</li>}
          {hits.map((h, i) => (
            <li key={`${h.type}_${h.id}`}>
              <button onClick={() => go(h)} onMouseEnter={() => setIdx(i)} className={cn('row w-full text-left', i === idx && 'bg-white/[0.06]')}>
                <span className="chip shrink-0">{h.typeLabel}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-white">{h.title}</span>
                  {h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}
                </span>
              </button>
            </li>
          ))}
          {q.trim() && (
            <li>
              <button
                className={cn('row w-full text-left text-sm text-glow', idx === hits.length && 'bg-white/[0.06]')}
                onClick={() => {
                  ui.close()
                  navigate(`/information?q=${encodeURIComponent(q)}`)
                }}
              >
                Show everything connected to “{q}”
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
