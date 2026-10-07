import { ArrowRight, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { areaOf, related } from '../ai/intelligence'
import { useDB, useEMS } from '../app/EMSContext'
import { AreaTag, Calm, DemoTag, Field, Modal, PageHeader, Panel } from '../components/ui'
import { ENTITY_COLLECTION, ENTITY_LABEL } from '../domain/labels'
import type { EntityType, Note } from '../domain/types'
import { cn } from '../lib/util'

type Tab = 'connected' | 'materials' | 'notes' | 'content' | 'people' | 'links'

const QUICK = ['Faith + Mental Health', 'Build Your Ark', 'Becoming Her', 'Steps to Victory', 'Summit']

export default function Information() {
  const db = useDB()
  const { store } = useEMS()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const [tab, setTab] = useState<Tab>(q ? 'connected' : 'materials')
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState({ title: '', body: '', kind: 'note' as Note['kind'], areaId: '' })
  const groups = useMemo(() => related(db, q), [db, q])

  const titleOf = (type: EntityType, id: string): string => {
    const rec = (db[ENTITY_COLLECTION[type]] as { id: string; name?: string; title?: string; label?: string }[]).find((r) => r.id === id)
    return rec?.name ?? rec?.title ?? rec?.label ?? id
  }

  return (
    <div>
      <PageHeader
        eyebrow="My Information"
        title="Everything you know, connected"
        sub="Books, courses, notes, decisions, people, and content — and how they relate. Ask for a topic to see everything connected to it."
        actions={
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={15} /> Add a note
          </button>
        }
      />
      <form
        className="glass mb-3 flex items-center gap-2 p-2"
        onSubmit={(e) => {
          e.preventDefault()
          setParams(input ? { q: input } : {})
          setTab('connected')
        }}
      >
        <Search size={16} className="ml-2 text-muted" />
        <input className="flex-1 bg-transparent py-2 text-white outline-none placeholder:text-muted" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Show me everything related to…" />
        <button className="btn-primary py-1.5 text-xs">Show</button>
      </form>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {QUICK.map((x) => (
          <button
            key={x}
            className="chip cursor-pointer hover:text-white"
            onClick={() => {
              setInput(x)
              setParams({ q: x })
              setTab('connected')
            }}
          >
            {x}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['connected', 'Connected view'],
            ['materials', 'Books, courses & materials'],
            ['notes', 'Notes & decisions'],
            ['content', 'Content'],
            ['people', 'People'],
            ['links', 'Relationships'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={cn('btn-ghost py-1.5 text-xs', tab === k && 'border-glow/60 bg-glow/10 text-white')} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'connected' &&
        (q ? (
          groups.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((g) => (
                <Panel key={g.label} title={`${g.label} · ${g.items.length}`}>
                  <ul className="-mx-3">
                    {g.items.map((i) => (
                      <li key={i.id}>
                        <Link to={i.href} className="row">
                          <span className="flex-1 text-sm text-white">{i.title}</span>
                          {i.sub && <span className="text-[11px] text-muted">{i.sub}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          ) : (
            <Calm>Nothing connected to “{q}” yet.</Calm>
          )
        ) : (
          <Calm>Type a topic, area, or project above.</Calm>
        ))}

      {tab === 'materials' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {db.assets.map((a) => (
            <div key={a.id} className="glass p-4">
              <p className="label">{a.kind.replace('_', ' ')}</p>
              <p className="mt-1 text-sm font-medium text-white">{a.title}</p>
              {a.description && <p className="mt-1 text-xs text-muted">{a.description}</p>}
              <div className="mt-2 flex items-center gap-2">
                <AreaTag area={areaOf(db, a.areaId)} />
                <span className="chip">{a.status.replace('_', ' ')}</span>
                <DemoTag show={a.demo} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'notes' && (
        <div className="grid gap-3 md:grid-cols-2">
          {db.notes.map((n) => (
            <div key={n.id} className="glass p-4">
              <p className="label">{n.kind}</p>
              <p className="mt-1 text-sm font-medium text-white">{n.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{n.body}</p>
              <div className="mt-2">
                <AreaTag area={areaOf(db, n.areaId)} />
              </div>
            </div>
          ))}
          {!db.notes.length && <Calm>No notes yet.</Calm>}
        </div>
      )}

      {tab === 'content' && (
        <Panel title="Content">
          <ul className="-mx-3">
            {db.content.map((c) => (
              <li key={c.id} className="row items-center">
                <span className="flex-1 text-sm text-white">{c.title}</span>
                {c.channel && <span className="chip">{c.channel}</span>}
                <span className="chip">{c.status}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">The content calendar and platform-specific builder arrive with the marketing phase. Repurposing is available from My AI Team.</p>
        </Panel>
      )}

      {tab === 'people' && (
        <div className="grid gap-3 md:grid-cols-3">
          {db.contacts.map((c) => (
            <div key={c.id} className="glass p-4">
              <p className="text-sm font-medium text-white">{c.name}</p>
              <p className="text-xs text-muted">{c.role}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {c.areaIds.map((id) => (
                  <AreaTag key={id} area={areaOf(db, id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'links' && (
        <Panel title="How things relate" hint="Book → Course → Event → Content → Campaign → Product → Income">
          <ul className="space-y-2">
            {db.links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="chip">{ENTITY_LABEL[l.fromType]}</span>
                <span className="text-white">{titleOf(l.fromType, l.fromId)}</span>
                <span className="flex items-center gap-1 text-xs text-glow">
                  {l.relation} <ArrowRight size={12} />
                </span>
                <span className="chip">{ENTITY_LABEL[l.toType]}</span>
                <span className="text-white">{titleOf(l.toType, l.toId)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a note">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!note.title) return
            store.create('notes', { title: note.title, body: note.body, kind: note.kind, areaId: note.areaId || undefined })
            setNote({ title: '', body: '', kind: 'note', areaId: '' })
            setAdding(false)
            setTab('notes')
          }}
        >
          <Field label="Title">
            <input autoFocus className="input" value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} />
          </Field>
          <Field label="Note">
            <textarea className="input" rows={5} value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <select className="input" value={note.kind} onChange={(e) => setNote({ ...note, kind: e.target.value as Note['kind'] })}>
                {['note', 'meeting', 'decision', 'document', 'sop', 'brand', 'research'].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            <Field label="Area">
              <select className="input" value={note.areaId} onChange={(e) => setNote({ ...note, areaId: e.target.value })}>
                <option value="">None</option>
                {db.areas.filter((a) => a.kind !== 'system').map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
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
