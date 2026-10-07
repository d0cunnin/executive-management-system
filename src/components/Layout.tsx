import {
  Bell, BookOpen, Bot, CalendarDays, CheckSquare, Compass, FileText, Heart, Lightbulb, LogOut, Menu, MessageCircle,
  Network, Plus, Search, Sparkles, Sun, Wallet, X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useDB, useEMS } from '../app/EMSContext'
import { useUI } from '../app/UIContext'
import { useAuth } from '../auth/AuthContext'
import { cn } from '../lib/util'
import { CommandPalette } from './CommandPalette'
import { ErrorBoundary } from './ErrorBoundary'
import { NewProjectModal } from './NewProjectModal'
import { notices } from './notifications'
import { QuickCapture } from './QuickCapture'

const MAIN: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Today', icon: <Sun size={17} /> },
  { to: '/assistant', label: 'Ask EMS', icon: <MessageCircle size={17} /> },
  { to: '/map', label: 'Command Center', icon: <Network size={17} /> },
  { to: '/work', label: 'My Work', icon: <Compass size={17} /> },
  { to: '/tasks', label: 'To-dos', icon: <CheckSquare size={17} /> },
  { to: '/calendar', label: 'Calendar', icon: <CalendarDays size={17} /> },
  { to: '/ideas', label: 'Ideas & Opportunities', icon: <Lightbulb size={17} /> },
  { to: '/income', label: 'Income', icon: <Wallet size={17} /> },
  { to: '/wellness', label: 'Wellness', icon: <Heart size={17} /> },
  { to: '/team', label: 'My AI Team', icon: <Bot size={17} /> },
  { to: '/information', label: 'My Information', icon: <BookOpen size={17} /> },
  { to: '/reviews', label: 'Briefs & Reviews', icon: <FileText size={17} /> },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const db = useDB()
  const approvals = db.actions.filter((a) => a.state === 'needs_approval').length
  const areas = db.areas.filter((a) => a.kind !== 'system' && a.slug !== 'wellness')
  return (
    <nav className="space-y-6">
      <ul className="space-y-0.5">
        {MAIN.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={n.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors', isActive ? 'bg-white/[0.07] text-white' : 'text-muted hover:bg-white/[0.04] hover:text-white')
              }
            >
              {n.icon}
              <span className="flex-1">{n.label}</span>
              {n.to === '/team' && approvals > 0 && <span className="rounded-full bg-gold/20 px-1.5 text-[10px] font-semibold text-gold">{approvals}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
      <div>
        <p className="label mb-2 px-3">My areas</p>
        <ul className="space-y-0.5">
          {areas.map((a) => (
            <li key={a.id}>
              <NavLink
                to={`/areas/${a.slug}`}
                onClick={onNavigate}
                className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-1.5 text-[13px] transition-colors', isActive ? 'bg-white/[0.07] text-white' : 'text-muted hover:text-white')}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: a.color, boxShadow: `0 0 10px ${a.color}` }} />
                {a.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

function Notifications() {
  const db = useDB()
  const list = useMemo(() => notices(db), [db])
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button className="btn-ghost relative px-2.5" onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${list.length})`}>
        <Bell size={16} />
        {list.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-glow px-1 text-[10px] font-semibold text-white">{list.length}</span>}
      </button>
      {open && (
        <div className="glass absolute right-0 z-40 mt-2 w-80 p-2" onMouseLeave={() => setOpen(false)}>
          {list.length === 0 ? (
            <p className="p-3 text-sm text-muted">Nothing needs you right now.</p>
          ) : (
            list.map((n) => (
              <Link key={n.key} to={n.href} onClick={() => setOpen(false)} className="row block">
                <div>
                  <p className="text-sm text-white">{n.title}</p>
                  <p className="text-xs text-muted">{n.body}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function Layout() {
  const { ai, store } = useEMS()
  const { mode, signOut, user } = useAuth()
  const ui = useUI()
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setDrawer(false)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ui.openSearch()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        ui.openCapture()
      }
      if (e.key === 'Escape') ui.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui])

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-ink-950/40 px-3 py-5 backdrop-blur-xl lg:flex">
        <Link to="/" className="mb-6 px-3">
          <p className="display text-xl leading-tight">D’Andrea Bolden</p>
          <p className="label mt-0.5 text-[10px]">Executive Management System</p>
        </Link>
        <div className="flex-1 overflow-y-auto pr-1">
          <NavItems />
        </div>
        <div className="mt-4 space-y-2 border-t border-line px-3 pt-4 text-xs text-muted">
          <p className="flex items-center gap-2">
            <Sparkles size={13} className={ai.connected ? 'text-emerald-300' : 'text-gold'} />
            {ai.label}
          </p>
          <p>{mode === 'demo' ? 'Demo mode · data stays in this browser' : user?.email}</p>
          <button className="flex items-center gap-2 hover:text-white" onClick={signOut}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-10">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-ink-950/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button className="btn-ghost px-2.5 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu size={16} />
          </button>
          <Link to="/" className="display text-lg lg:hidden">EMS</Link>
          <button className="btn-ghost ml-auto flex-1 justify-start text-muted sm:max-w-sm lg:ml-0" onClick={ui.openSearch}>
            <Search size={15} />
            <span className="truncate">Search everything</span>
            <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[10px] sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-ghost hidden sm:inline-flex" onClick={() => ui.openCapture()}>
              <Sparkles size={15} /> Quick capture
            </button>
            <button className="btn-primary hidden sm:inline-flex" onClick={() => ui.openNewProject()}>
              <Plus size={15} /> New project
            </button>
            <Notifications />
          </div>
        </header>

        {store.error && <div className="mx-4 mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 sm:mx-6">{store.error}</div>}

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          {/* Keyed by page so moving to another page clears an error. */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-ink-950/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Main">
        {[
          { to: '/', label: 'Today', icon: <Sun size={19} /> },
          { to: '/assistant', label: 'Ask', icon: <MessageCircle size={19} /> },
        ].map((n) => (
          <NavLink key={n.to} to={n.to} end className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[10px]', isActive ? 'text-white' : 'text-muted')}>
            {n.icon}
            {n.label}
          </NavLink>
        ))}
        <button className="flex flex-col items-center justify-center" onClick={() => ui.openCapture()} aria-label="Quick capture">
          <span className="-mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-glow text-white shadow-[0_8px_30px_-6px_rgb(139_124_255/0.9)]">
            <Plus size={22} />
          </span>
        </button>
        {[
          { to: '/tasks', label: 'To-dos', icon: <CheckSquare size={19} /> },
          { to: '/calendar', label: 'Calendar', icon: <CalendarDays size={19} /> },
        ].map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[10px]', isActive ? 'text-white' : 'text-muted')}>
            {n.icon}
            {n.label}
          </NavLink>
        ))}
      </nav>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm lg:hidden" onClick={() => setDrawer(false)}>
          <div className="h-full w-[82%] max-w-xs overflow-y-auto border-r border-line bg-ink-900 px-3 py-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between px-3">
              <p className="display text-xl">D’Andrea Bolden</p>
              <button onClick={() => setDrawer(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <button className="btn-primary mb-4 w-full justify-center" onClick={() => ui.openNewProject()}>
              <Plus size={15} /> New project
            </button>
            <NavItems onNavigate={() => setDrawer(false)} />
            <div className="mt-6 space-y-2 border-t border-line px-3 pt-4 text-xs text-muted">
              <p>{ai.label}</p>
              <button className="flex items-center gap-2" onClick={signOut}>
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <QuickCapture />
      <NewProjectModal />
      <CommandPalette />
    </div>
  )
}
