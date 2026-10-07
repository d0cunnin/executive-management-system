import { ArrowUp, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ask, SUGGESTED, type AssistantReply } from '../ai/assistant'
import { useEMS } from '../app/EMSContext'
import { cn } from '../lib/util'

interface Turn {
  role: 'me' | 'ems'
  text: string
  reply?: AssistantReply
}

export default function Assistant() {
  const { store, ai } = useEMS()
  const [params, setParams] = useSearchParams()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const send = async (q: string) => {
    if (!q.trim() || busy) return
    setTurns((t) => [...t, { role: 'me', text: q }])
    setInput('')
    setBusy(true)
    const reply = await ask(store, ai, q)
    setTurns((t) => [...t, { role: 'ems', text: reply.text, reply }])
    setBusy(false)
  }

  useEffect(() => {
    const q = params.get('q')
    if (q) {
      setParams({}, { replace: true })
      send(q)
    }
  }, [params])

  // Braces matter: newer browsers return a Promise from scrollIntoView, and
  // React would try to call anything an effect returns as its cleanup.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, busy])

  return (
    <div className="mx-auto flex min-h-[calc(100vh-180px)] max-w-3xl flex-col">
      <div className="mb-4">
        <p className="label">Ask EMS</p>
        <h1 className="display text-3xl sm:text-4xl">What would help right now?</h1>
        <p className="mt-1 text-xs text-muted">
          <Sparkles size={12} className="mr-1 inline" />
          {ai.connected ? 'Answers come from your EMS data, with your connected AI for everything else.' : 'Answers come from your EMS data. Open-ended questions need an AI model connected.'}
        </p>
      </div>

      <div className="flex-1 space-y-4">
        {turns.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTED.map((s) => (
              <button key={s} className="glass rounded-xl p-3 text-left text-sm text-mist transition-colors hover:border-glow/50 hover:text-white" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn('rise flex', t.role === 'me' ? 'justify-end' : 'justify-start')}>
            {t.role === 'me' ? (
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-glow/25 px-4 py-2.5 text-sm text-white">{t.text}</p>
            ) : (
              <div className="glass max-w-[95%] rounded-bl-md p-4">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white">{t.text}</p>
                {t.reply?.items && t.reply.items.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {t.reply.items.map((it, j) => {
                      const body = (
                        <>
                          <p className="text-sm text-white">{it.label}</p>
                          {it.sub && <p className="text-xs text-muted">{it.sub}</p>}
                        </>
                      )
                      return (
                        <li key={j}>
                          {it.href ? (
                            <Link to={it.href} className="row -mx-2 block">
                              {body}
                            </Link>
                          ) : (
                            <button className="row -mx-2 block w-full text-left" onClick={() => send(it.label)}>
                              {body}
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
                {t.reply?.link && (
                  <Link to={t.reply.link.href} className="btn-primary mt-3 py-1.5 text-xs">
                    {t.reply.link.label}
                  </Link>
                )}
                <p className="mt-2 text-[10px] text-muted">{t.reply?.engine === 'ai' ? 'Connected AI' : 'From your EMS data'}</p>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Thinking…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="glass sticky bottom-24 mt-6 flex items-center gap-2 p-2 lg:bottom-6"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <input
          className="flex-1 bg-transparent px-3 py-2 text-white outline-none placeholder:text-muted"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="“Move the Summit forward” · “Turn this into a project: …”"
          aria-label="Ask EMS"
        />
        <button className="btn-primary h-10 w-10 justify-center p-0" disabled={!input.trim() || busy} aria-label="Send">
          <ArrowUp size={16} />
        </button>
      </form>
    </div>
  )
}
