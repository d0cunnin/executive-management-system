// The assistant understands D'Andrea's everyday questions and answers them
// from EMS data. Commands that change things ("turn this into a project",
// "move X forward") act on the store. Anything it cannot answer from data is
// passed to a connected model, or it says plainly that none is connected.
import type { Store } from '../data/store'
import { MODE_LABEL } from '../domain/labels'
import type { DB } from '../domain/types'
import { friendlyDate, money, timeOf } from '../lib/util'
import {
  aiCanDo, classifyCapture, comingUp, focusAdvice, incomeSummary, iNeedToHandle, isOpen, loadCheck, monetizationScan,
  movedForward, moveAreaForward, moveProjectForward, needsAttention, related, waitingOn, whatNext,
} from './intelligence'
import type { AIProvider } from './provider'

export interface AssistantReply {
  text: string
  items?: { label: string; sub?: string; href?: string }[]
  /** Offer to open a page, e.g. the Move This Forward panel. */
  link?: { label: string; href: string }
  engine: 'builtin' | 'ai'
}

/** Find the project or area named in free text. */
function findTarget(db: DB, text: string) {
  const t = text.toLowerCase()
  const score = (name: string) => {
    const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2)
    return words.filter((w) => t.includes(w)).length / Math.max(1, words.length)
  }
  const project = db.projects.filter(isOpen).map((p) => ({ p, s: score(p.name) })).sort((a, b) => b.s - a.s)[0]
  const area = db.areas.map((a) => ({ a, s: score(a.name) })).sort((x, y) => y.s - x.s)[0]
  if (area && area.s >= 0.6 && (!project || area.s >= project.s)) return { kind: 'area' as const, area: area.a }
  if (project && project.s >= 0.5) return { kind: 'project' as const, project: project.p }
  return null
}

const reply = (text: string, extra: Partial<AssistantReply> = {}): AssistantReply => ({ text, engine: 'builtin', ...extra })

export async function ask(store: Store, provider: AIProvider, question: string): Promise<AssistantReply> {
  const db = store.snapshot()
  const q = question.trim()
  const l = q.toLowerCase()

  // Turn this into a project: …
  const turn = q.match(/^(?:turn (?:this|that) into a project|make (?:this|that) a project|new project)[:\-–]?\s*(.+)$/i)
  if (turn) {
    const c = classifyCapture(turn[1])
    const p = store.create('projects', {
      name: c.title, outcome: c.title, areaId: c.areaId ?? 'area_personal', status: 'planning', cadence: 'none',
      progress: 0, lastActivityAt: new Date().toISOString(), incomePotential: c.incomeSignal ? 'medium' : undefined,
    })
    store.logProgress({ kind: 'decision', title: `Started project: ${p.name}`, projectId: p.id, areaId: p.areaId })
    return reply(`Done — I created the project “${p.name}” in ${db.areas.find((a) => a.id === p.areaId)?.name}. Open it and press Move This Forward and I will break it down.`, { link: { label: 'Open project', href: `/projects/${p.id}` } })
  }

  // Move X forward
  if (/move .* forward|move this forward|^advance /.test(l)) {
    const target = findTarget(db, q)
    if (!target) return reply('Which project or area should I move forward? For example: “Move the Faith + Mental Health Summit forward.”')
    if (target.kind === 'area') {
      const plan = moveAreaForward(db, target.area.id)
      return reply(plan.headline, {
        items: plan.plans.flatMap((x) => x.plan.aiCanDo.slice(0, 2).map((a) => ({ label: a.label, sub: `${x.project.name} · ${a.consequential ? 'needs your approval' : 'AI can prepare'}`, href: `/projects/${x.project.id}` }))).slice(0, 6),
        link: { label: `Open ${target.area.name}`, href: `/areas/${target.area.slug}?move=1` },
      })
    }
    const plan = moveProjectForward(db, target.project)
    return reply(plan.headline, {
      items: [
        ...plan.aiCanDo.map((a) => ({ label: a.label, sub: a.consequential ? 'AI prepares · you approve' : 'AI can do this now' })),
        ...plan.youNeedTo.map((y) => ({ label: y, sub: 'You need to do this' })),
      ],
      link: { label: 'Open Move This Forward', href: `/projects/${target.project.id}?move=1` },
    })
  }

  // Show me everything related to X
  const rel = q.match(/(?:everything|all) (?:related to|about|for|connected to)\s+(.+?)\??$/i)
  if (rel) {
    const groups = related(db, rel[1])
    if (!groups.length) return reply(`I could not find anything connected to “${rel[1]}” yet.`)
    return reply(`Here is everything connected to ${rel[1]}.`, {
      items: groups.flatMap((g) => g.items.slice(0, 4).map((i) => ({ label: i.title, sub: g.label, href: i.href }))),
      link: { label: 'Open the connected view', href: `/information?q=${encodeURIComponent(rel[1])}` },
    })
  }

  if (/work on next|what should i (do|focus)|priorit/.test(l)) {
    const recs = whatNext(db)
    const advice = focusAdvice(db)
    return reply(recs.length ? `Here is what I would work on next.${advice ? ` ${advice}` : ''}` : 'Nothing stands out right now. This can wait.', {
      items: recs.map((r) => ({ label: r.title, sub: r.why, href: `/projects/${r.projectId}` })),
    })
  }

  if (/needs? my attention|what('s| is) stuck|stalled|forgetting/.test(l)) {
    const items = needsAttention(db)
    return reply(items.length ? `${items.length} thing${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} attention.` : 'Nothing needs your attention right now.', {
      items: items.slice(0, 8).map((i) => ({ label: i.title, sub: i.why, href: i.href })),
    })
  }

  if (/ai (can )?(handle|do)|delegate/.test(l)) {
    const items = aiCanDo(db)
    return reply(items.length ? `I can take ${items.length} thing${items.length === 1 ? '' : 's'} off your plate.` : 'Nothing is queued for AI right now.', {
      items: items.map((t) => ({ label: t.title, sub: MODE_LABEL[t.mode], href: t.projectId ? `/projects/${t.projectId}` : '/tasks' })),
    })
  }

  if (/what do i (need|have) to do|my (tasks|to-?dos)|today/.test(l)) {
    const mine = iNeedToHandle(db)
    const load = loadCheck(db)
    return reply((mine.length ? 'These are the things only you can do.' : 'Nothing needs you personally right now.') + (load ? ` ${load}` : ''), {
      items: mine.map((t) => ({ label: t.title, sub: t.dueDate ? friendlyDate(t.dueDate) : undefined, href: t.projectId ? `/projects/${t.projectId}` : '/tasks' })),
    })
  }

  if (/coming up|this week|calendar|schedule/.test(l)) {
    const ev = comingUp(db, 14)
    return reply(ev.length ? 'Coming up in the next two weeks:' : 'Your next two weeks are clear.', {
      items: ev.map((e) => ({ label: e.title, sub: `${friendlyDate(e.start)} ${timeOf(e.start)}`.trim(), href: '/calendar' })),
    })
  }

  if (/waiting/.test(l)) {
    const w = waitingOn(db)
    return reply(w.length ? `You are waiting on ${w.length} thing${w.length === 1 ? '' : 's'}.` : 'You are not waiting on anyone.', {
      items: w.map((t) => ({ label: t.title, sub: `${t.waitingOn} · ${t.days} days`, href: t.projectId ? `/projects/${t.projectId}` : '/tasks' })),
    })
  }

  if (/monetiz|make (me )?money|already have|income|revenue/.test(l)) {
    const inc = incomeSummary(db)
    const scan = monetizationScan(db)
    return reply(
      `Received this month: ${money(inc.receivedThisMonth)}. Expected (not yet received): ${money(inc.expected)}. Forecasts and estimates are not guaranteed. Here is what you already have that could earn more:`,
      { items: scan.map((m) => ({ label: m.asset, sub: m.options.slice(0, 3).join(' · '), href: '/income' })), link: { label: 'Open Income', href: '/income' } },
    )
  }

  if (/accomplish|moved forward|progress|did i do/.test(l)) {
    const m = movedForward(db, 7)
    return reply(m.length ? 'Here is what moved forward this week.' : 'Nothing recorded as moving forward this week yet.', {
      items: m.map((p) => ({ label: p.title, sub: friendlyDate(p.at) })),
    })
  }

  if (/close to (done|completion|finish)/.test(l)) {
    const close = db.projects.filter((p) => isOpen(p) && p.progress >= 70)
    return reply(close.length ? 'These are close to done:' : 'No projects are close to done yet.', { items: close.map((p) => ({ label: p.name, sub: `${p.progress}%`, href: `/projects/${p.id}` })) })
  }

  // Not a known question. Use the connected model if there is one.
  if (provider.connected) {
    try {
      const context = [
        `Open projects: ${db.projects.filter(isOpen).map((p) => `${p.name} (${p.status}, ${p.progress}%)`).join('; ')}`,
        `Needs attention: ${needsAttention(db).map((a) => `${a.title}: ${a.why}`).join('; ')}`,
        `Coming up: ${comingUp(db, 7).map((e) => `${e.title} ${friendlyDate(e.start)}`).join('; ')}`,
      ].join('\n')
      const text = await provider.generate({ agentKey: 'executive', instruction: q, context })
      return { text, engine: 'ai' }
    } catch (e) {
      return reply(`I could not reach the AI just now (${e instanceof Error ? e.message : 'error'}).`)
    }
  }
  return reply(
    'I can answer that once an AI model is connected. Right now I can answer from your EMS data — try one of these:',
    { items: SUGGESTED.map((s) => ({ label: s })) },
  )
}

export const SUGGESTED = [
  'What needs my attention?',
  'What should I work on next?',
  'What can AI handle today?',
  'What is coming up?',
  'What can make me money?',
  'Move the Faith + Mental Health Summit forward',
  'Show me everything related to Build Your Ark',
  'What did I accomplish this week?',
]
