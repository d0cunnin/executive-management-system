// The night shift: while D'Andrea sleeps, her AI team works through the
// to-dos marked for AI and leaves a short brief for the morning.
//
// Hard lines (the same as the rest of EMS):
// - Everything is a draft. Nothing is sent, posted, published, paid or deleted.
// - Anything public or external waits in her approval list.
// - The brief reports only what actually happened.
import { aiCanDo } from '../ai/intelligence'
import type { AIProvider } from '../ai/provider'
import { runTask } from '../ai/routing'
import type { Store } from '../data/store'
import type { Task } from '../domain/types'

export interface NightShiftResult {
  drafted: { title: string; needsApproval: boolean }[]
  /** To-dos left for another night because of the nightly limit. */
  leftForLater: number
  /** Why the shift stopped early, if it did. */
  stopped?: string
}

const OPEN_ACTION = new Set(['draft', 'needs_approval'])

/** To-dos the AI can take tonight: marked for AI, open, and no draft already waiting on her. */
export function nightQueue(store: Store): Task[] {
  const db = store.snapshot()
  const busy = new Set(db.actions.filter((a) => a.taskId && OPEN_ACTION.has(a.state)).map((a) => a.taskId))
  return aiCanDo(db).filter((t) => !busy.has(t.id))
}

export async function runNightShift(store: Store, provider: AIProvider, opts: { max: number }): Promise<NightShiftResult> {
  const queue = nightQueue(store)
  const result: NightShiftResult = { drafted: [], leftForLater: Math.max(0, queue.length - opts.max) }

  if (!provider.connected) {
    result.stopped = 'The AI isn’t connected, so nothing was drafted.'
    result.leftForLater = queue.length
  } else {
    for (const [i, t] of queue.slice(0, opts.max).entries()) {
      const action = await runTask(store, provider, t)
      if (action.engine !== 'ai') {
        // The AI couldn't be reached. A template isn't worth waking up to:
        // undo this one and leave the rest for the next night.
        store.remove('actions', action.id)
        store.update('tasks', t.id, { status: 'todo' })
        result.stopped = `The AI couldn’t be reached (${action.summary?.match(/\((.*)\)/)?.[1] ?? 'no reply'}), so the shift stopped early.`
        result.leftForLater = queue.length - i
        break
      }
      result.drafted.push({ title: t.title, needsApproval: action.state === 'needs_approval' })
    }
  }

  if (result.drafted.length || result.stopped) writeBrief(store, result)
  await store.whenSaved()
  return result
}

/** Leave the morning brief, replacing any brief she hasn't opened yet. */
function writeBrief(store: Store, r: NightShiftResult) {
  for (const n of store.snapshot().notifications) if (n.kind === 'night_shift' && !n.read) store.update('notifications', n.id, { read: true })
  const approve = r.drafted.filter((d) => d.needsApproval).length
  const title = r.drafted.length
    ? `Overnight, your AI team drafted ${r.drafted.length} thing${r.drafted.length === 1 ? '' : 's'}${approve ? ` — ${approve} need${approve === 1 ? 's' : ''} your approval` : ''}.`
    : 'The night shift didn’t get to anything.'
  const body = [
    ...r.drafted.map((d) => `${d.needsApproval ? '◆' : '•'} ${d.title}${d.needsApproval ? ' (waiting for your approval)' : ''}`),
    r.leftForLater ? `${r.leftForLater} more to-do${r.leftForLater === 1 ? '' : 's'} left for another night.` : '',
    r.stopped ?? '',
    'Nothing was sent, posted or published.',
  ].filter(Boolean).join('\n')
  store.create('notifications', { kind: 'night_shift', title, body, href: '/team', read: false })
}
