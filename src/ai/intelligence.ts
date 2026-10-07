// EMS intelligence: pure functions that reason over D'Andrea's actual data.
// These run without any AI model connected. They power TODAY, Move This
// Forward, What Should I Work On Next, and the assistant's built-in answers.
// A connected model can add drafting and research on top; it never replaces
// these data checks.
import { OPEN_STATUSES } from '../domain/labels'
import type { Area, Cadence, DB, Idea, IdeaVerdict, Project, Task } from '../domain/types'
import { daysSince, daysUntil, parseDate } from '../lib/util'

// ── Helpers ─────────────────────────────────────────────────────────────────

export const isOpen = (p: Project) => OPEN_STATUSES.includes(p.status)
export const isOpenTask = (t: Task) => t.status !== 'done'

const CADENCE_DAYS: Record<Cadence, number | null> = { none: null, daily: 1, weekly: 7, monthly: 31, quarterly: 92, custom: null }

export function areaOf(db: DB, id?: string): Area | undefined {
  return id ? db.areas.find((a) => a.id === id) : undefined
}

export function projectTasks(db: DB, projectId: string) {
  return db.tasks.filter((t) => t.projectId === projectId)
}

/** How urgent/important a task is, for sorting. Higher first. */
function taskScore(t: Task): number {
  let s = t.importance * 10
  if (t.dueDate) {
    const d = daysUntil(t.dueDate)
    if (d < 0) s += 40
    else if (d <= 1) s += 30
    else if (d <= 3) s += 18
    else if (d <= 7) s += 8
  }
  if (t.status === 'doing') s += 6
  return s
}

// ── TODAY ───────────────────────────────────────────────────────────────────

/** The few things only D'Andrea can do. Deliberately short. */
export function iNeedToHandle(db: DB, limit = 5): Task[] {
  return db.tasks
    .filter((t) => t.mode === 'me' && (t.status === 'todo' || t.status === 'doing'))
    .sort((a, b) => taskScore(b) - taskScore(a))
    .slice(0, limit)
}

export function aiCanDo(db: DB): Task[] {
  return db.tasks
    .filter((t) => t.mode !== 'me' && (t.status === 'todo' || t.status === 'doing'))
    .sort((a, b) => taskScore(b) - taskScore(a))
}

export function waitingOn(db: DB): (Task & { days: number })[] {
  return db.tasks
    .filter((t) => t.status === 'waiting')
    .map((t) => ({ ...t, days: t.waitingSince ? daysSince(t.waitingSince) : 0 }))
    .sort((a, b) => b.days - a.days)
}

export interface AttentionItem {
  key: string
  title: string
  why: string
  href: string
  severity: 1 | 2 | 3
}

/** Things beginning to stall or needing a decision. */
export function needsAttention(db: DB): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const p of db.projects.filter(isOpen)) {
    const idle = daysSince(p.lastActivityAt)
    const href = `/projects/${p.id}`
    if (p.status === 'at_risk') items.push({ key: p.id, title: p.name, why: p.blocker ?? 'Marked at risk.', href, severity: 3 })
    else if (p.status === 'needs_attention') items.push({ key: p.id, title: p.name, why: p.blocker ?? `No movement in ${idle} days.`, href, severity: 3 })
    else if (p.status === 'paused' && idle > 28) items.push({ key: p.id, title: p.name, why: `Paused for ${idle} days. Restart it, or let it go?`, href, severity: 1 })
    else if (p.status === 'idea' && idle > 30) continue
    else if (['active', 'planning'].includes(p.status) && idle >= 7) items.push({ key: p.id, title: p.name, why: `Nothing has moved in ${idle} days.`, href, severity: 2 })
    else if (p.dueDate && daysUntil(p.dueDate) < 0) items.push({ key: p.id, title: p.name, why: 'Past its date.', href, severity: 3 })
  }
  for (const o of db.ongoing) {
    const every = CADENCE_DAYS[o.cadence]
    if (!every || !o.lastDoneAt) continue
    const late = daysSince(o.lastDoneAt) - every
    if (late >= Math.max(2, every * 0.5)) {
      items.push({ key: o.id, title: o.title, why: `Usually ${o.cadence}; last done ${daysSince(o.lastDoneAt)} days ago.`, href: `/areas/${areaOf(db, o.areaId)?.slug ?? ''}`, severity: 1 })
    }
  }
  for (const t of db.tasks.filter((t) => t.status !== 'done' && t.status !== 'waiting' && t.dueDate && daysUntil(t.dueDate) < 0)) {
    items.push({ key: t.id, title: t.title, why: 'Overdue.', href: t.projectId ? `/projects/${t.projectId}` : '/tasks', severity: 3 })
  }
  return items.sort((a, b) => b.severity - a.severity)
}

export function comingUp(db: DB, days = 14) {
  const now = Date.now()
  return db.events
    .filter((e) => {
      const d = daysUntil(e.start)
      return d >= 0 && d <= days && (e.allDay || parseDate(e.end ?? e.start).getTime() >= now - 3_600_000)
    })
    .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime())
}

export function incomeSummary(db: DB) {
  const sum = (c: string, inWindow?: (d: number) => boolean) =>
    db.income.filter((i) => i.certainty === c && (!inWindow || inWindow(daysUntil(i.date)))).reduce((s, i) => s + i.amount, 0)
  return {
    receivedThisMonth: db.income
      .filter((i) => i.certainty === 'actual' && parseDate(i.date).getMonth() === new Date().getMonth() && parseDate(i.date).getFullYear() === new Date().getFullYear())
      .reduce((s, i) => s + i.amount, 0),
    receivedLast90: sum('actual', (d) => d <= 0 && d >= -90),
    expected: sum('expected'),
    forecast: sum('forecast'),
    estimate: sum('estimate'),
  }
}

export function wellnessSummary(db: DB) {
  const week = db.wellness.filter((w) => daysSince(w.date) <= 7)
  const avg = (k: 'sleepHours' | 'energy' | 'waterCups') => {
    const v = week.map((w) => w[k]).filter((x): x is number => typeof x === 'number')
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
  }
  const movement = week.reduce((s, w) => s + (w.movementMinutes ?? 0), 0)
  const activeDays = week.filter((w) => (w.movementMinutes ?? 0) > 0).length
  const today = db.wellness.find((w) => daysSince(w.date) === 0 && daysUntil(w.date) === 0)
  return { movement, activeDays, sleep: avg('sleepHours'), energy: avg('energy'), water: avg('waterCups'), today, entries: week.length }
}

/**
 * Notices when D'Andrea is carrying a lot and recovery is thin. Returns a
 * gentle note or null. This is about balance, not diagnosis.
 */
export function loadCheck(db: DB): string | null {
  const active = db.projects.filter((p) => ['active', 'needs_attention', 'at_risk'].includes(p.status)).length
  const myOpen = db.tasks.filter((t) => t.mode === 'me' && isOpenTask(t) && t.status !== 'waiting').length
  const w = wellnessSummary(db)
  const recoveryThin = (w.sleep !== null && w.sleep < 6.5) || (w.energy !== null && w.energy < 3) || w.activeDays < 3
  if (active >= 6 && recoveryThin) {
    return `You are pushing ${active} projects forward and your rest has been light this week. I recommend protecting some time for yourself before adding another major commitment.`
  }
  if (myOpen > 12) return 'Your personal list is long. Let me take more of the AI-ready work so you can focus on what only you can do.'
  return null
}

export function movedForward(db: DB, days = 7) {
  return db.progress.filter((p) => daysSince(p.at) <= days).sort((a, b) => b.at.localeCompare(a.at))
}

// ── WHAT SHOULD I WORK ON NEXT? ─────────────────────────────────────────────

export interface Recommendation {
  projectId: string
  title: string
  why: string
  score: number
}

/**
 * Scores open projects on closeness to done, urgency, income, momentum, and
 * strategic value, then explains the top few in plain words.
 */
export function whatNext(db: DB, limit = 3): Recommendation[] {
  const recs: Recommendation[] = []
  for (const p of db.projects.filter((p) => isOpen(p) && p.status !== 'idea' && p.status !== 'paused')) {
    const reasons: string[] = []
    let score = 0
    if (p.progress >= 70) {
      score += 30
      reasons.push(`It is ${p.progress}% done — finishing it unlocks what comes after.`)
    }
    if (p.dueDate) {
      const d = daysUntil(p.dueDate)
      if (d <= 14) {
        score += 25 - Math.max(0, d)
        reasons.push(d < 0 ? 'It is past its date.' : `It is due in ${d} days.`)
      }
    }
    const income = { none: 0, low: 5, medium: 12, high: 22 }[p.incomePotential ?? 'none']
    if (income >= 12) {
      score += income
      reasons.push('It is tied to income.')
    }
    if (p.status === 'needs_attention' || p.status === 'at_risk') {
      score += 20
      reasons.push(p.blocker ? `It is stuck: ${p.blocker.replace(/\.$/, '')}.` : 'It has stalled and needs a decision.')
    }
    const goal = db.goals.find((g) => g.id === p.goalId)
    if (goal) {
      score += 8
      reasons.push(`It moves your goal “${goal.title}”.`)
    }
    const myBlocking = projectTasks(db, p.id).filter((t) => t.mode === 'me' && isOpenTask(t) && t.status !== 'waiting' && t.importance >= 5)
    if (myBlocking.length) {
      score += 10
      reasons.push(`One decision from you moves it: “${myBlocking[0].title}”.`)
    }
    if (p.status === 'waiting') score -= 15
    if (reasons.length) recs.push({ projectId: p.id, title: p.name, why: reasons.slice(0, 2).join(' '), score })
  }
  return recs.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** When adding more would hurt focus, say so. */
export function focusAdvice(db: DB): string | null {
  const nearlyDone = db.projects.filter((p) => isOpen(p) && p.progress >= 70)
  if (nearlyDone.length >= 2) {
    return `I do not recommend starting another project right now. You already have ${nearlyDone.length} projects close to completion.`
  }
  return null
}

// ── MOVE THIS FORWARD ───────────────────────────────────────────────────────

export interface ProposedAction {
  key: string
  label: string
  agentKey: string
  skill: string
  /** Public, external, financial, or deletion — needs approval before it runs. */
  consequential: boolean
  taskId?: string
}

export interface MoveForwardPlan {
  headline: string
  where: string
  goal: string
  done: string[]
  blocking: string[]
  nextMilestone?: { title: string; due?: string }
  nextAction?: string
  aiCanDo: ProposedAction[]
  youNeedTo: string[]
  delegate: string[]
  missing: string[]
  deadline?: string
  cadence?: string
  nothingNeeded: boolean
}

const SKILL_FOR_TASK: [RegExp, string, string, boolean][] = [
  [/social|post|instagram|facebook|tiktok|reel/i, 'social', 'social_posts', true],
  [/email|newsletter/i, 'marketing', 'draft_email', true],
  [/outline|lesson|course|module/i, 'course', 'course_outline', false],
  [/research|find|identify/i, 'research', 'research_brief', false],
  [/announce|request|send|invite|follow[- ]?up/i, 'admin', 'draft_follow_up', true],
  [/grant|budget/i, 'nonprofit', 'grant_prep', false],
  [/review|report|organize/i, 'executive', 'weekly_review', false],
]

export function skillForTask(t: Task): Pick<ProposedAction, 'agentKey' | 'skill' | 'consequential'> {
  for (const [re, agentKey, skill, consequential] of SKILL_FOR_TASK) if (re.test(t.title)) return { agentKey, skill, consequential }
  return { agentKey: 'writing', skill: 'draft_outline', consequential: false }
}

export function moveProjectForward(db: DB, p: Project): MoveForwardPlan {
  const tasks = projectTasks(db, p.id)
  const ms = db.milestones.filter((m) => m.projectId === p.id)
  const nextMs = ms.filter((m) => !m.done).sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'))[0]
  const waiting = tasks.filter((t) => t.status === 'waiting')
  const mine = tasks.filter((t) => t.mode === 'me' && (t.status === 'todo' || t.status === 'doing')).sort((a, b) => taskScore(b) - taskScore(a))
  const aiTasks = tasks.filter((t) => t.mode !== 'me' && isOpenTask(t))
  const idle = daysSince(p.lastActivityAt)
  const blocking = [
    ...(p.blocker ? [p.blocker] : []),
    ...waiting.map((t) => `Waiting on ${t.waitingOn ?? 'someone'} for “${t.title}”${t.waitingSince ? ` (${daysSince(t.waitingSince)} days)` : ''}.`),
  ]
  const missing: string[] = []
  if (!p.outcome) missing.push('What this project is trying to accomplish.')
  if (!ms.length) missing.push('Milestones — what “done” looks like along the way.')
  if (!tasks.filter(isOpenTask).length) missing.push('A next step. Nothing is on the list yet.')
  if (p.incomePotential === undefined) missing.push('Whether this connects to income.')

  const aiCanDoList: ProposedAction[] = aiTasks.map((t) => ({ key: t.id, label: t.title, taskId: t.id, ...skillForTask(t) }))
  if (!ms.length || !tasks.length) aiCanDoList.push({ key: 'breakdown', label: 'Break this project into milestones and first steps', agentKey: 'project', skill: 'break_down_project', consequential: false })
  for (const w of waiting.filter((w) => (w.waitingSince ? daysSince(w.waitingSince) : 0) >= 3)) {
    aiCanDoList.push({ key: `fu_${w.id}`, label: `Draft a follow-up to ${w.waitingOn ?? 'them'} about “${w.title}”`, agentKey: 'admin', skill: 'draft_follow_up', consequential: true, taskId: w.id })
  }
  const campaign = db.campaigns.find((c) => c.projectId === p.id)
  if (campaign && !aiCanDoList.some((a) => a.skill === 'campaign_strategy')) {
    aiCanDoList.push({ key: 'camp', label: `Review “${campaign.name}” and suggest what to change`, agentKey: 'marketing', skill: 'campaign_strategy', consequential: false })
  }

  const youNeedTo = mine.slice(0, 3).map((t) => t.title)
  const delegate = waiting.length ? [] : tasks.filter((t) => t.mode === 'me' && isOpenTask(t) && /send|collect|schedule|book|gather/i.test(t.title)).map((t) => t.title)

  let headline: string
  const nothingNeeded = !blocking.length && !youNeedTo.length && !aiCanDoList.length && !missing.length
  if (p.status === 'completed' || p.status === 'closed') headline = 'This is finished. See what comes next below.'
  else if (nothingNeeded) headline = 'Nothing needs your attention here right now.'
  else if (!ms.length && !tasks.length) headline = 'This is just getting started. I can break it into milestones and first steps.'
  else if (blocking.length) headline = `The biggest issue right now: ${blocking[0].replace(/\.$/, '')}.`
  else if (p.progress >= 70) headline = `This is close — ${p.progress}% done. Focus on finishing.`
  else if (idle >= 7) headline = `This has not moved in ${idle} days. One small step will restart it.`
  else headline = 'This is moving. Here is what keeps it moving.'

  return {
    headline,
    where: `${p.progress}% of the way there · ${idle === 0 ? 'active today' : `last movement ${idle} day${idle === 1 ? '' : 's'} ago`}`,
    goal: p.outcome,
    done: [...ms.filter((m) => m.done).map((m) => m.title), ...tasks.filter((t) => t.status === 'done' && !ms.some((m) => m.title === t.title)).map((t) => t.title)].slice(0, 5),
    blocking,
    nextMilestone: nextMs ? { title: nextMs.title, due: nextMs.dueDate } : undefined,
    nextAction: mine[0]?.title ?? aiTasks[0]?.title,
    aiCanDo: aiCanDoList,
    youNeedTo,
    delegate,
    missing,
    deadline: p.dueDate,
    cadence: p.cadence !== 'none' ? p.cadence : undefined,
    nothingNeeded,
  }
}

export interface AreaPlan {
  headline: string
  moving: Project[]
  stalled: AttentionItem[]
  plans: { project: Project; plan: MoveForwardPlan }[]
  quiet: boolean
}

export function moveAreaForward(db: DB, areaId: string): AreaPlan {
  const projects = db.projects.filter((p) => p.areaId === areaId && isOpen(p))
  const stalled = needsAttention(db).filter((i) => projects.some((p) => p.id === i.key) || db.ongoing.some((o) => o.id === i.key && o.areaId === areaId))
  const plans = projects
    .filter((p) => p.status !== 'idea')
    .map((project) => ({ project, plan: moveProjectForward(db, project) }))
    .sort((a, b) => b.plan.blocking.length + b.plan.aiCanDo.length - (a.plan.blocking.length + a.plan.aiCanDo.length))
  const moving = projects.filter((p) => daysSince(p.lastActivityAt) < 7 && p.status === 'active')
  const top = stalled[0]
  const aiCount = plans.reduce((s, x) => s + x.plan.aiCanDo.length, 0)
  const headline = !projects.length
    ? 'Nothing active here yet. That may be exactly right.'
    : top
      ? `The biggest issue right now is “${top.title}”: ${top.why} ${moving.length ? `${moving.map((m) => m.name).join(' and ')} ${moving.length === 1 ? 'is' : 'are'} on track.` : ''} I found ${aiCount} thing${aiCount === 1 ? '' : 's'} I can prepare now.`
      : `Everything here is moving. I found ${aiCount} thing${aiCount === 1 ? '' : 's'} I can prepare to keep it that way.`
  return { headline: headline.replace(/\s+/g, ' ').trim(), moving, stalled, plans, quiet: !stalled.length && aiCount === 0 }
}

// ── QUICK CAPTURE ───────────────────────────────────────────────────────────

export interface Classification {
  type: import('../domain/types').CaptureType
  areaId?: string
  title: string
  incomeSignal: boolean
  possibleProject?: string
  confidence: 'high' | 'medium' | 'low'
}

const AREA_HINTS: [RegExp, string][] = [
  [/faith\s*\+?\s*(&|and)?\s*mental health summit|\bsummit\b|speaker|sponsor|vendor|attendee|registration/i, 'area_summit'],
  [/build your ark|\bark\b|substack|prepar(ed|ation|edness)/i, 'area_ark'],
  [/becoming her|discipleship|mentorship|mentee/i, 'area_becoming'],
  [/steps to victory|\bstem\b|road to tech|youth|grant|capital campaign|innovation team/i, 'area_stv'],
  [/sockzoo|soc+kzoo|church|ministry|sermon|volunteer|pastor|worship/i, 'area_church'],
  [/\bdbm\b|course|student|curriculum|certification|enrollment|lesson|learning area|faith\s*\+?\s*(&|and)?\s*mental health/i, 'area_dbm'],
  [/book|manuscript|chapter|publish|editor|workbook/i, 'area_books'],
  [/youtube|podcast|instagram|tiktok|facebook|linkedin|reel|short|post|content|newsletter/i, 'area_content'],
  [/income|revenue|price|pricing|sell|sales|client|invoice|speaking fee|workshop|membership/i, 'area_business'],
  [/walk|workout|exercise|stretch|yoga|sleep|water|hydrat|rest|recovery|wellness/i, 'area_wellness'],
  [/doctor|dentist|appointment|bill|car|insurance|errand|birthday|family|home/i, 'area_personal'],
]

export function classifyCapture(text: string): Classification {
  const t = text.trim()
  const lower = t.toLowerCase()
  const areaId = AREA_HINTS.find(([re]) => re.test(t))?.[1]
  const incomeSignal = /course|workbook|book|certification|workshop|product|sell|price|membership|speaking|sponsor|kit|bundle|program/i.test(t)
  const title = t.replace(/^(i need to|need to|i should|remember to|remind me to|todo:?|idea:?|note:?)\s+/i, '').replace(/^\w/, (c) => c.toUpperCase())

  let type: Classification['type'] = 'note'
  let confidence: Classification['confidence'] = 'medium'
  if (/^(idea:|what if|i('| a)m thinking about|maybe (we|i) (could|should))|thinking about creating/i.test(lower)) type = 'idea'
  else if (/opportunit|conference|call for (speakers|proposals)|rfp|grant (deadline|opening)|partner(ship)? with/i.test(lower)) type = 'opportunity'
  else if (/^(remind me|reminder|don'?t forget)/i.test(lower)) type = 'reminder'
  else if (/meeting|call with|zoom|appointment (with|at)|\b(at|@) \d{1,2}(:\d\d)?\s?(am|pm)\b/i.test(lower)) type = 'meeting'
  else if (/^(project:|turn this into a project)|launch (a|the)|build (a|the)|create (a|an|the) .*(course|workbook|website|program|campaign|book)/i.test(lower)) type = /^need to|^i need to/i.test(lower) ? 'idea' : 'project'
  else if (/post about|video (about|on)|reel|youtube|podcast episode|substack (post|article)|content idea/i.test(lower)) type = 'content'
  else if (/@|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|contact:|met (someone|a)/i.test(lower)) type = 'contact'
  else if (/^(need to|i need to|todo|call|email|send|buy|pay|schedule|book|renew|finish|review|sign|follow up)/i.test(lower)) type = 'task'
  else if (/^(note:|notes from|takeaway)/i.test(lower)) type = 'note'
  else confidence = 'low'

  // "Need to create a workbook for..." reads as a task but is really a
  // potential project and income idea. Treat it as an idea to decide on.
  let possibleProject: string | undefined
  if (/(create|build|write|launch|develop|design) (a|an|the|my)?\s*(course|workbook|book|program|certification|website|product|kit|series|curriculum|workshop)/i.test(lower)) {
    possibleProject = title
    if (type === 'task') {
      type = 'idea'
      confidence = 'medium'
    }
  }
  return { type, areaId, title, incomeSignal, possibleProject, confidence }
}

// ── IDEAS & INCOME ──────────────────────────────────────────────────────────

/**
 * First-pass view on an idea from what is already in EMS. External demand,
 * competition and pricing need the Research Assistant with a connected model.
 */
export function evaluateIdea(db: DB, idea: Idea): { verdict: IdeaVerdict; reasoning: string } {
  let score = 0
  const why: string[] = []
  const builds = (idea.buildsOnIds ?? []).map((id) => db.assets.find((a) => a.id === id)).filter(Boolean)
  if (builds.length) {
    score += 2
    why.push(`It builds on what you already have (${builds.map((b) => b!.title).join(', ')}).`)
  }
  if (idea.incomePotential === 'high') {
    score += 2
    why.push('It has strong income potential.')
  } else if (idea.incomePotential === 'medium') score += 1
  if (idea.effort === 'small') {
    score += 1
    why.push('It is a small lift.')
  } else if (idea.effort === 'large') {
    score -= 1
    why.push('It is a large lift.')
  }
  const busy = db.projects.filter((p) => p.areaId === idea.areaId && ['active', 'needs_attention', 'at_risk'].includes(p.status)).length
  if (busy >= 2) {
    score -= 1
    why.push(`This area already has ${busy} active projects — timing matters.`)
  }
  const verdict: IdeaVerdict = score >= 4 ? 'strong' : score >= 2 ? 'worth_exploring' : score >= 1 ? 'later' : score >= 0 ? 'low' : 'not_recommended'
  if (verdict === 'strong' && busy >= 2) why.push('Strong — but consider starting after a current project finishes.')
  return { verdict, reasoning: why.join(' ') || 'Not enough information yet to judge. Add what it builds on and its income potential.' }
}

export interface MonetizeIdea {
  assetId: string
  asset: string
  options: string[]
  why: string
}

const MONETIZE_PATHS: Record<string, string[]> = {
  book: ['Companion workbook', 'Course built on the chapters', 'Speaking talk', 'Book club kit'],
  workbook: ['One-day workshop', 'Group coaching cohort', 'Digital download', 'Church licensing'],
  course: ['Certification', 'Workshop for organizations', 'Bundle with a book', 'Licensing to churches'],
  curriculum: ['Licensing to schools or churches', 'Train-the-trainer program', 'Grant-funded delivery'],
  presentation: ['Paid workshop', 'Webinar', 'Speaking package'],
  video_series: ['Paid replay library', 'Course lessons', 'Clips for content'],
  newsletter: ['Paid tier', 'Collected into a book or guide', 'Lead magnet'],
  training: ['Workshop', 'Consulting package'],
  framework: ['Consulting', 'Certification', 'Workbook'],
  research: ['White paper', 'Talk', 'Article series'],
}

/** What already exists that could become something valuable. */
export function monetizationScan(db: DB): MonetizeIdea[] {
  const liveOfferFor = (assetId: string) =>
    db.links.some((l) => l.fromId === assetId && l.toType === 'offer' && db.offers.find((o) => o.id === l.toId)?.status === 'live')
  return db.assets
    .filter((a) => a.status === 'complete' || a.status === 'in_progress')
    .filter((a) => !liveOfferFor(a.id))
    .map((a) => ({
      assetId: a.id,
      asset: a.title,
      options: MONETIZE_PATHS[a.kind] ?? ['Workshop', 'Digital product'],
      why: a.status === 'complete' ? 'This is finished and not currently being sold.' : 'This is in progress — plan the offer now so it is ready when it is done.',
    }))
}

// ── CONNECTED VIEW ──────────────────────────────────────────────────────────

export interface RelatedGroup {
  label: string
  items: { id: string; title: string; href: string; sub?: string }[]
}

/** Everything connected to a topic or area: "Show me everything related to …" */
export function related(db: DB, query: string): RelatedGroup[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const area = db.areas.find((a) => a.name.toLowerCase().includes(q) || a.slug === q || q.includes(a.name.toLowerCase()))
  const words = q.split(/[\s+&]+/).filter((w) => w.length > 2 && !['and', 'the', 'everything', 'related'].includes(w))
  const match = (s?: string) => !!s && words.length > 0 && words.every((w) => s.toLowerCase().includes(w))
  const inArea = (id?: string) => !!area && id === area.id

  const projects = db.projects.filter((p) => inArea(p.areaId) || match(p.name) || match(p.outcome))
  const projectIds = new Set(projects.map((p) => p.id))
  const assets = db.assets.filter((a) => inArea(a.areaId) || match(a.title) || match(a.description))
  const ids = new Set([...projectIds, ...assets.map((a) => a.id)])
  // Follow links one step so related books, offers and ideas come along.
  for (const l of db.links) {
    if (ids.has(l.fromId)) ids.add(l.toId)
    if (ids.has(l.toId)) ids.add(l.fromId)
  }
  const pick = <T extends { id: string }>(list: T[], test: (x: T) => boolean) => list.filter((x) => ids.has(x.id) || test(x))

  const groups: RelatedGroup[] = [
    { label: 'Projects', items: pick(db.projects, (p) => projectIds.has(p.id)).map((p) => ({ id: p.id, title: p.name, href: `/projects/${p.id}`, sub: p.status.replace('_', ' ') })) },
    { label: 'Books, courses & materials', items: pick(db.assets, (a) => inArea(a.areaId) || match(a.title)).map((a) => ({ id: a.id, title: a.title, href: '/information', sub: a.kind.replace('_', ' ') })) },
    { label: 'Campaigns', items: db.campaigns.filter((c) => inArea(c.areaId) || projectIds.has(c.projectId ?? '') || match(c.name)).map((c) => ({ id: c.id, title: c.name, href: '/work', sub: c.status })) },
    { label: 'Content', items: db.content.filter((c) => inArea(c.areaId) || match(c.title)).map((c) => ({ id: c.id, title: c.title, href: '/information', sub: c.status })) },
    { label: 'Offers & income', items: [
      ...pick(db.offers, (o) => inArea(o.areaId) || match(o.name)).map((o) => ({ id: o.id, title: o.name, href: '/income', sub: o.status })),
      ...db.income.filter((i) => inArea(i.areaId) || match(i.label)).map((i) => ({ id: i.id, title: i.label, href: '/income', sub: i.certainty })),
    ] },
    { label: 'Ideas & opportunities', items: pick(db.ideas, (i) => inArea(i.areaId) || match(i.title) || match(i.description)).map((i) => ({ id: i.id, title: i.title, href: '/ideas', sub: i.status })) },
    { label: 'Calendar', items: db.events.filter((e) => inArea(e.areaId) || projectIds.has(e.projectId ?? '') || match(e.title)).map((e) => ({ id: e.id, title: e.title, href: '/calendar' })) },
    { label: 'Notes & decisions', items: db.notes.filter((n) => inArea(n.areaId) || projectIds.has(n.projectId ?? '') || match(n.title) || match(n.body)).map((n) => ({ id: n.id, title: n.title, href: '/information', sub: n.kind })) },
    { label: 'People', items: db.contacts.filter((c) => c.areaIds.some(inArea) || match(c.name)).map((c) => ({ id: c.id, title: c.name, href: '/information', sub: c.role })) },
  ]
  return groups.filter((g) => g.items.length)
}
