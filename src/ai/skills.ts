// What each assistant can actually do. A skill prepares output (from a
// connected model, or a built-in template computed from EMS data) and may
// have an effect inside EMS when D'Andrea approves it.
//
// Nothing here sends, publishes, or spends anything outside EMS. Those
// integrations are not connected yet, and the UI says so.
import { CHANNEL_LABEL, MODE_LABEL } from '../domain/labels'
import type { AIAction, Channel, DB } from '../domain/types'
import type { Store } from '../data/store'
import { friendlyDate, money } from '../lib/util'
import {
  aiCanDo, areaOf, comingUp, incomeSummary, iNeedToHandle, monetizationScan, movedForward, needsAttention,
  waitingOn, wellnessSummary, whatNext,
} from './intelligence'
import type { AIProvider } from './provider'

export interface SkillContext {
  db: DB
  projectId?: string
  areaId?: string
  taskId?: string
  /** Free text, e.g. the content to repurpose or the idea to evaluate. */
  input?: string
}

export interface SkillDef {
  key: string
  name: string
  /** True when the result goes public, external, or costs money. */
  consequential: boolean
  instruction: (c: SkillContext) => string
  template: (c: SkillContext) => string
  /** Optional change made inside EMS when the action is approved. */
  apply?: (store: Store, action: AIAction) => string
}

const brandVoice = (db: DB) => db.notes.find((n) => n.kind === 'brand')?.body ?? 'Warm, direct, faith-rooted, practical.'

function describe(c: SkillContext): string {
  const { db } = c
  const p = c.projectId ? db.projects.find((x) => x.id === c.projectId) : undefined
  const a = areaOf(db, c.areaId ?? p?.areaId)
  const camp = p ? db.campaigns.find((x) => x.projectId === p.id) : undefined
  const t = c.taskId ? db.tasks.find((x) => x.id === c.taskId) : undefined
  return [
    a && `Area: ${a.name} — ${a.tagline}`,
    p && `Project: ${p.name}. Trying to accomplish: ${p.outcome}. Status ${p.status}, ${p.progress}% done.${p.blocker ? ` Blocker: ${p.blocker}` : ''}`,
    t && `Task: ${t.title}${t.waitingOn ? ` (waiting on ${t.waitingOn})` : ''}`,
    camp && `Campaign: ${camp.name}. Objective ${camp.objective}. Audience: ${camp.audience ?? 'not set'}. Message: ${camp.message ?? 'not set'}. Offer: ${camp.offer ?? 'not set'}. CTA: ${camp.cta ?? 'not set'}. Channels: ${camp.channels.join(', ')}.`,
    c.input && `Input: ${c.input}`,
    `Brand voice: ${brandVoice(db)}`,
  ].filter(Boolean).join('\n')
}

const PLATFORM_SHAPE: Partial<Record<Channel, string>> = {
  instagram: 'Hook in the first line · 3–5 short lines · carousel or Reel concept · CTA “link in bio” · 3–5 focused hashtags',
  facebook: 'Conversational opener · a short story or question · invite comments · direct link CTA',
  linkedin: 'Professional insight up top · 2–3 short paragraphs · leader/counselor angle · link in first comment',
  tiktok: '1-second visual hook · spoken script under 45s · on-screen text · CTA in caption',
  youtube: 'Searchable title · 8–12 min outline · chapters · CTA mid-roll and end screen',
  youtube_shorts: 'Hook in 2 seconds · one idea · vertical · CTA to the full video',
  email: 'Subject line + preview text · one story · one CTA button',
  substack: 'Headline · personal opening · 3 sections · subscribe/share CTA',
  pinterest: 'Keyword-rich title · vertical graphic · link to resource',
}

function socialTemplate(c: SkillContext): string {
  const p = c.projectId ? c.db.projects.find((x) => x.id === c.projectId) : undefined
  const camp = p ? c.db.campaigns.find((x) => x.projectId === p.id) : undefined
  const channels: Channel[] = camp?.channels.filter((ch) => ch !== 'email') ?? ['instagram', 'facebook', 'linkedin']
  const lines = [
    `Audience: ${camp?.audience ?? 'Set the audience before drafting.'}`,
    `Message: ${camp?.message ?? 'Set the core message.'}`,
    `CTA: ${camp?.cta ?? 'Choose one call to action.'}`,
    '',
    'A 7-post plan, adapted per platform (not copied across):',
    ...['Why this matters (problem)', 'A story or testimony', 'Speaker / expert spotlight', 'Myth vs. truth', 'Behind the scenes', 'Practical tip people can use today', 'Direct invitation + deadline'].map(
      (angle, i) => `${i + 1}. ${angle} — ${CHANNEL_LABEL[channels[i % channels.length]]}`,
    ),
    '',
    'How each platform is shaped:',
    ...channels.map((ch) => `• ${CHANNEL_LABEL[ch]}: ${PLATFORM_SHAPE[ch] ?? 'Adapt length and CTA to the platform.'}`),
  ]
  return lines.join('\n')
}

function briefText(db: DB): string {
  const mine = iNeedToHandle(db, 5)
  const ai = aiCanDo(db)
  const att = needsAttention(db)
  const wait = waitingOn(db)
  const up = comingUp(db, 3)
  const inc = incomeSummary(db)
  const w = wellnessSummary(db)
  return [
    'WHAT MATTERS TODAY',
    ...(att.slice(0, 3).map((a) => `• ${a.title} — ${a.why}`)),
    '',
    'YOU NEED TO HANDLE',
    ...(mine.length ? mine.map((t) => `• ${t.title}${t.dueDate ? ` (${friendlyDate(t.dueDate)})` : ''}`) : ['• Nothing urgent.']),
    '',
    `AI CAN DO (${ai.length})`,
    ...ai.slice(0, 5).map((t) => `• ${t.title} — ${MODE_LABEL[t.mode]}`),
    '',
    'COMING UP',
    ...(up.length ? up.map((e) => `• ${friendlyDate(e.start)}: ${e.title}`) : ['• Nothing in the next 3 days.']),
    '',
    'WAITING ON',
    ...(wait.length ? wait.map((t) => `• ${t.waitingOn}: ${t.title} (${t.days} days)`) : ['• Nobody.']),
    '',
    `INCOME — received this month ${money(inc.receivedThisMonth)} · expected ${money(inc.expected)} (not yet received)`,
    `WELLNESS — ${w.movement} active minutes over ${w.activeDays} days this week${w.sleep ? ` · sleep avg ${w.sleep}h` : ''}`,
  ].join('\n')
}

function weeklyText(db: DB): string {
  const moved = movedForward(db, 7)
  const stalled = needsAttention(db)
  const done = db.tasks.filter((t) => t.status === 'done' && t.doneAt && Date.now() - new Date(t.doneAt).getTime() < 7 * 86_400_000)
  const next = whatNext(db)
  const inc = incomeSummary(db)
  return [
    'WHAT MOVED FORWARD',
    ...(moved.length ? moved.map((m) => `• ${m.title}`) : ['• Nothing recorded this week.']),
    '',
    'COMPLETED',
    ...(done.length ? done.map((t) => `• ${t.title}`) : ['• No to-dos completed.']),
    '',
    'WHAT STALLED',
    ...(stalled.length ? stalled.slice(0, 6).map((s) => `• ${s.title} — ${s.why}`) : ['• Nothing stalled.']),
    '',
    `INCOME — received (90 days) ${money(inc.receivedLast90)} · expected ${money(inc.expected)} · forecast ${money(inc.forecast)} · estimates ${money(inc.estimate)}`,
    '',
    'WHAT SHOULD HAPPEN NEXT',
    ...next.map((r, i) => `${i + 1}. ${r.title} — ${r.why}`),
  ].join('\n')
}

function periodText(db: DB, days: number, label: string): string {
  const since = Date.now() - days * 86_400_000
  const inPeriod = (iso?: string) => !!iso && new Date(iso).getTime() >= since
  const moved = db.progress.filter((p) => inPeriod(p.at))
  const completed = db.projects.filter((p) => p.finish && inPeriod(p.finish.finishedAt))
  const received = db.income.filter((i) => i.certainty === 'actual' && inPeriod(i.date)).reduce((s, i) => s + i.amount, 0)
  const pending = db.income.filter((i) => i.certainty !== 'actual').reduce((s, i) => s + i.amount, 0)
  const stalled = needsAttention(db)
  const byArea = new Map<string, number>()
  for (const m of moved) if (m.areaId) byArea.set(m.areaId, (byArea.get(m.areaId) ?? 0) + 1)
  const quiet = db.areas.filter((a) => a.kind !== 'system' && !byArea.has(a.id) && db.projects.some((p) => p.areaId === a.id && p.status !== 'completed'))
  const published = db.content.filter((c) => c.status === 'published' && inPeriod(c.publishDate))
  const opportunities = db.ideas.filter((i) => i.status === 'new' || i.status === 'exploring')
  return [
    `${label.toUpperCase()} — last ${days} days`,
    '',
    'MAJOR PROGRESS',
    ...(completed.length ? completed.map((p) => `• Completed: ${p.name}`) : ['• No projects finished in this period.']),
    `• ${moved.length} meaningful steps forward across ${byArea.size} areas.`,
    '',
    `INCOME — received ${money(received)} · not yet received (expected, forecast, estimates) ${money(pending)}`,
    '',
    `CONTENT — ${published.length} piece${published.length === 1 ? '' : 's'} published`,
    '',
    'WHERE ENERGY WENT',
    ...[...byArea.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => `• ${areaOf(db, id)?.name}: ${n}`),
    '',
    'QUIET AREAS',
    ...(quiet.length ? quiet.map((a) => `• ${a.name}`) : ['• None.']),
    '',
    'PROBLEMS',
    ...(stalled.length ? stalled.slice(0, 6).map((x) => `• ${x.title} — ${x.why}`) : ['• None.']),
    '',
    `OPPORTUNITIES OPEN — ${opportunities.length}`,
    ...opportunities.slice(0, 5).map((i) => `• ${i.title}`),
    '',
    days >= 90 ? 'WHAT TO STOP · CONTINUE · BUILD NEXT' : 'STRATEGIC RECOMMENDATIONS',
    ...(days >= 90
      ? [
          `• Consider stopping or pausing: ${quiet.map((a) => a.name).join(', ') || 'nothing obvious'}.`,
          `• Continue: ${[...byArea.keys()].slice(0, 3).map((id) => areaOf(db, id)?.name).join(', ') || '—'}.`,
          `• Build next: ${whatNext(db, 1)[0]?.title ?? 'decide from Ideas & Opportunities'}.`,
        ]
      : whatNext(db).map((r, i) => `${i + 1}. ${r.title} — ${r.why}`)),
  ].join('\n')
}

export const SKILLS: Record<string, SkillDef> = {
  daily_brief: { key: 'daily_brief', name: 'Daily brief', consequential: false, instruction: () => 'Write a short daily brief.', template: (c) => briefText(c.db) },
  monthly_review: { key: 'monthly_review', name: 'Monthly review', consequential: false, instruction: () => 'Write the monthly review.', template: (c) => periodText(c.db, 31, 'Monthly review') },
  quarterly_review: { key: 'quarterly_review', name: 'Quarterly review', consequential: false, instruction: () => 'Write the quarterly review.', template: (c) => periodText(c.db, 92, 'Quarterly review') },
  weekly_review: { key: 'weekly_review', name: 'Weekly review', consequential: false, instruction: () => 'Write the weekly review.', template: (c) => weeklyText(c.db) },
  what_next: {
    key: 'what_next', name: 'What should I work on next?', consequential: false,
    instruction: () => 'Recommend what to work on next and why.',
    template: (c) => whatNext(c.db).map((r, i) => `${i + 1}. ${r.title}\n   ${r.why}`).join('\n') || 'Nothing stands out. This is a good day to rest or finish small things.',
  },
  needs_attention_scan: {
    key: 'needs_attention_scan', name: 'What needs attention', consequential: false,
    instruction: () => 'List what is stalling and what decision would unblock it.',
    template: (c) => needsAttention(c.db).map((a) => `• ${a.title} — ${a.why}`).join('\n') || 'Nothing needs your attention right now.',
  },
  organize_captures: {
    key: 'organize_captures', name: 'Organize captured notes', consequential: false,
    instruction: () => 'Group and summarize recent captures.',
    template: (c) => {
      const recent = c.db.captures.slice(-20)
      if (!recent.length) return 'Nothing captured recently. Nothing to organize.'
      const by = new Map<string, string[]>()
      for (const cap of recent) by.set(cap.classifiedAs, [...(by.get(cap.classifiedAs) ?? []), cap.text])
      return [...by.entries()].map(([k, v]) => `${k.toUpperCase()}\n${v.map((x) => `• ${x}`).join('\n')}`).join('\n\n')
    },
  },
  prep_appointments: {
    key: 'prep_appointments', name: 'Prepare for appointments', consequential: false,
    instruction: () => 'List upcoming personal appointments and what to bring.',
    template: (c) => comingUp(c.db, 7).filter((e) => e.kind === 'appointment' || e.kind === 'personal').map((e) => `• ${friendlyDate(e.start)} — ${e.title}`).join('\n') || 'No personal appointments this week.',
  },
  move_forward: { key: 'move_forward', name: 'Move this forward', consequential: false, instruction: () => 'Explain the next move.', template: () => 'Open the project and use Move This Forward.' },
  break_down_project: {
    key: 'break_down_project', name: 'Break into milestones', consequential: false,
    instruction: (c) => 'Propose 3–5 milestones and the first concrete step for each.' + describe(c),
    template: (c) => {
      const p = c.db.projects.find((x) => x.id === c.projectId)
      return [`Suggested milestones for “${p?.name ?? 'this project'}”:`, '1. Define what finished looks like', '2. Gather what already exists', '3. Produce the first complete draft', '4. Review and refine', '5. Share / launch', '', 'Approve to add these as milestones. Edit them freely afterward.'].join('\n')
    },
    apply: (store, action) => {
      if (!action.projectId) return 'No project to add milestones to.'
      const lines = (action.output ?? '').split('\n').filter((l) => /^\d+\.\s/.test(l))
      for (const l of lines) store.create('milestones', { projectId: action.projectId, title: l.replace(/^\d+\.\s*/, ''), done: false })
      return `Added ${lines.length} milestones.`
    },
  },
  finish_project: { key: 'finish_project', name: 'Finish a project', consequential: false, instruction: () => '', template: () => 'Use “Finish this project” on the project page.' },
  draft_follow_up: {
    key: 'draft_follow_up', name: 'Draft a follow-up', consequential: true,
    instruction: (c) => 'Draft a short, warm follow-up message.\n' + describe(c),
    template: (c) => {
      const t = c.db.tasks.find((x) => x.id === c.taskId)
      return `To: ${t?.waitingOn ?? '[name]'}\nSubject: Checking in on ${t?.title ?? '[item]'}\n\nHi [name],\n\nI hope you are well. I wanted to check in on ${t?.title?.toLowerCase() ?? '[item]'} — it is the piece we need to keep things moving. Could you send it by [date]? If anything is in the way, let me know how I can help.\n\nThank you,\nD’Andrea`
    },
  },
  waiting_on_review: {
    key: 'waiting_on_review', name: 'Review what I am waiting on', consequential: false, instruction: () => '',
    template: (c) => waitingOn(c.db).map((t) => `• ${t.waitingOn}: ${t.title} — ${t.days} days${t.days >= 5 ? ' (follow up)' : ''}`).join('\n') || 'Not waiting on anyone.',
  },
  campaign_strategy: {
    key: 'campaign_strategy', name: 'Campaign strategy', consequential: false,
    instruction: (c) => 'As a senior marketing strategist, review this campaign: audience, awareness level, offer, message, CTA, conversion path. Say what is working, what is not, what to test.\n' + describe(c),
    template: (c) => {
      const camp = c.db.campaigns.find((x) => x.projectId === c.projectId)
      if (!camp) return 'No campaign found for this project.'
      const m = camp.metrics ?? {}
      const gaps = (['audience', 'message', 'offer', 'cta'] as const).filter((k) => !camp[k])
      return [
        `Campaign: ${camp.name} (objective: ${camp.objective})`,
        m.reach !== undefined && `Numbers so far (entered in EMS): reach ${m.reach}, clicks ${m.clicks ?? '—'}, ${camp.objective.toLowerCase()} ${m.registrations ?? m.sales ?? '—'}`,
        m.clicks && m.registrations ? `Click-to-${camp.objective.toLowerCase()} rate: ${Math.round((m.registrations / m.clicks) * 100)}%` : null,
        gaps.length ? `Missing before this can perform: ${gaps.join(', ')}.` : 'Strategy basics are in place.',
        '',
        'Questions to decide:',
        '• Which audience segment converts best — leaders or members?',
        '• Is the offer clear and time-bound (deadline)?',
        '• Does every post point to one CTA?',
        '',
        'Test next: a deadline-driven email vs. a story-driven email to the same list.',
        '(Built-in planner: connect AI for a full strategist review.)',
      ].filter(Boolean).join('\n')
    },
  },
  draft_email: {
    key: 'draft_email', name: 'Draft an email', consequential: true,
    instruction: (c) => 'Draft a marketing email: subject, preview text, body with one story, one CTA.\n' + describe(c),
    template: (c) => {
      const camp = c.db.campaigns.find((x) => x.projectId === c.projectId)
      return [`Subject: [Benefit-led subject — ${camp?.offer ?? 'the offer'}]`, 'Preview: [one line that finishes the subject’s thought]', '', 'Opening: a short story your reader recognizes.', `Turn: ${camp?.message ?? '[core message]'}`, `Offer: ${camp?.offer ?? '[offer]'} — what they get and by when.`, `Button: ${camp?.cta ?? '[CTA]'}`, 'P.S. Deadline reminder.'].join('\n')
    },
  },
  social_posts: {
    key: 'social_posts', name: 'Platform-specific posts', consequential: true,
    instruction: (c) => 'Write platform-specific social posts. Adapt hook, length, structure, CTA, and visual concept per platform. Do not copy the same post across platforms.\n' + describe(c),
    template: socialTemplate,
  },
  repurpose: {
    key: 'repurpose', name: 'Repurpose content', consequential: false,
    instruction: (c) => 'Suggest how to repurpose this piece into other formats, one line each.\n' + describe(c),
    template: (c) => [`From: ${c.input ?? 'this piece'}`, '', 'Options (choose what to create):', '• YouTube video — the full idea, taught', '• YouTube Short / Reel / TikTok — one striking line', '• Instagram carousel — the steps or key points', '• LinkedIn post — the leadership lesson', '• Facebook post — a question that invites stories', '• Email — the story + one CTA', '• Substack article — the longer reflection', '• Podcast topic — a conversation with a guest', '• Course lesson — teach it with an exercise', '• Workbook activity — a reflection prompt'].join('\n'),
  },
  monetize_assets: {
    key: 'monetize_assets', name: 'Find income in what I have', consequential: false,
    instruction: () => 'Review existing intellectual property and suggest ways to turn it into income.',
    template: (c) => monetizationScan(c.db).map((m) => `${m.asset}\n  ${m.why}\n  Could become: ${m.options.join(' · ')}`).join('\n\n') || 'Everything you have is already being offered.',
  },
  evaluate_idea: { key: 'evaluate_idea', name: 'Should I pursue this?', consequential: false, instruction: (c) => 'Evaluate this idea: demand, audience, pricing, competition, existing assets, work required, potential income, strategic fit. Cite current sources.\n' + describe(c), template: () => 'Open the idea to see the first-pass evaluation.' },
  research_brief: {
    key: 'research_brief', name: 'Research brief', consequential: false,
    instruction: (c) => 'Research this using current sources and cite them.\n' + describe(c),
    template: (c) => ['Research needs a connected AI model with web access. Nothing has been researched yet.', '', 'Questions I would answer:', `• What is current demand for ${c.input ?? 'this'}?`, '• Who else offers something similar, and at what price?', '• Which audiences are underserved?', '• What funding, partners, or events relate to it?'].join('\n'),
  },
  draft_outline: {
    key: 'draft_outline', name: 'Draft an outline', consequential: false,
    instruction: (c) => 'Draft a clear outline.\n' + describe(c),
    template: (c) => {
      const t = c.db.tasks.find((x) => x.id === c.taskId)
      return [`Outline: ${t?.title ?? c.input ?? 'piece'}`, '1. Opening — why this matters', '2. Main idea', '3. Supporting points (3)', '4. Practical application', '5. Closing + next step'].join('\n')
    },
  },
  course_outline: {
    key: 'course_outline', name: 'Course outline', consequential: false,
    instruction: (c) => 'Draft lesson outlines with objectives, key teaching, activity, and reflection.\n' + describe(c),
    template: (c) => {
      const t = c.db.tasks.find((x) => x.id === c.taskId)
      return [`${t?.title ?? 'Lessons'}`, 'For each lesson:', '• Learning objective', '• Key teaching (10–15 min)', '• Scripture / research anchor', '• Activity or workbook page', '• Reflection question', '• Assessment check'].join('\n')
    },
  },
  launch_checklist: {
    key: 'launch_checklist', name: 'Book launch checklist', consequential: false, instruction: () => 'Create a book launch checklist.',
    template: () => ['Book launch checklist', '• Final edit + proof', '• Cover and interior design', '• ISBN and listings', '• Launch team', '• Advance reader copies', '• Launch email sequence', '• Launch event / live', '• Related course or workbook offer'].join('\n'),
  },
  event_runsheet: {
    key: 'event_runsheet', name: 'Event run sheet', consequential: false, instruction: () => 'Create an event run sheet.',
    template: () => ['Run sheet', '• Load-in and setup', '• Registration desk', '• Welcome', '• Sessions + transitions', '• Sponsor moments', '• Closing + CTA', '• Follow-up email within 48 hours'].join('\n'),
  },
  grant_prep: {
    key: 'grant_prep', name: 'Grant preparation', consequential: false, instruction: (c) => 'Prepare grant application sections.\n' + describe(c),
    template: () => ['Grant sections to prepare', '• Need statement (with local data)', '• Program description', '• Outcomes and evaluation', '• Budget + budget narrative', '• Organizational capacity', '• Letters of support'].join('\n'),
  },
  ministry_plan: { key: 'ministry_plan', name: 'Ministry plan', consequential: false, instruction: () => 'Draft a ministry plan.', template: () => ['Ministry plan', '• Purpose', '• Team and roles', '• Calendar', '• Communications', '• Volunteers needed'].join('\n') },
  draft_announcement: { key: 'draft_announcement', name: 'Draft an announcement', consequential: true, instruction: (c) => 'Draft a church announcement.\n' + describe(c), template: () => 'Announcement: [what] · [when] · [where] · [who to contact]' },
  study_plan: {
    key: 'study_plan', name: 'Two-week study plan', consequential: false,
    instruction: (c) => 'Build a realistic two-week nursing school study plan around these classes, clinicals, exams and assignments. Protect rest before clinicals and exams.\n' + describe(c),
    template: (c) => {
      const nursing = (e: { areaId?: string; kind: string }) => e.areaId === 'area_nursing' || ['class', 'exam', 'clinical'].includes(e.kind)
      const events = comingUp(c.db, 14).filter(nursing)
      const exams = events.filter((e) => e.kind === 'exam')
      const todo = c.db.tasks.filter((t) => t.areaId === 'area_nursing' && t.status !== 'done')
      if (!events.length && !todo.length) return 'Nothing for nursing school is on your calendar or to-do list yet. Add your classes, clinicals, exams and assignments, and I will build the plan around them.'
      return [
        'COMING UP (next 2 weeks)',
        ...(events.length ? events.map((e) => `• ${friendlyDate(e.start)} — ${e.title} (${e.kind})`) : ['• Nothing scheduled.']),
        '',
        'ASSIGNMENTS & TO-DOS',
        ...(todo.length ? todo.map((t) => `• ${t.title}${t.dueDate ? ` — due ${friendlyDate(t.dueDate)}` : ''}`) : ['• None listed.']),
        '',
        'PLAN',
        ...exams.map((e) => `• ${e.title}: start reviewing 5–7 days before. Short daily sessions beat one long night.`),
        '• Block 45–60 minutes of study on non-clinical days; review notes the same day as class.',
        '• Practice questions (NCLEX-style) 3× a week, 15–25 questions per session.',
        '• Keep the night before a clinical or exam light, and protect your sleep.',
      ].join('\n')
    },
  },
  wellness_check: {
    key: 'wellness_check', name: 'Wellness check-in', consequential: false, instruction: () => 'Encourage balance gently. No diagnosis, no body image.',
    template: (c) => {
      const w = wellnessSummary(c.db)
      return [`This week: ${w.movement} active minutes across ${w.activeDays} days.`, w.sleep ? `Average sleep: ${w.sleep} hours.` : 'No sleep logged.', w.activeDays < 3 ? 'A 10-minute walk today would be a good win.' : 'You are being consistent. Keep it gentle.', 'This is encouragement, not medical advice.'].join('\n')
    },
  },
}

/**
 * Run a skill and record the result as an AI action. Consequential results
 * wait for approval; everything else is a draft D'Andrea can use or discard.
 */
export async function runSkill(
  store: Store,
  provider: AIProvider,
  opts: { skill: string; agentKey: string; title: string; projectId?: string; areaId?: string; taskId?: string; input?: string; consequential?: boolean },
): Promise<AIAction> {
  const def = SKILLS[opts.skill] ?? SKILLS.draft_outline
  const ctx: SkillContext = { db: store.snapshot(), projectId: opts.projectId, areaId: opts.areaId, taskId: opts.taskId, input: opts.input }
  let output: string
  let engine: AIAction['engine'] = 'builtin'
  let summary = 'Prepared by the built-in planner from your EMS data. No AI model is connected.'
  if (provider.connected) {
    try {
      output = await provider.generate({ agentKey: opts.agentKey, instruction: def.instruction(ctx), context: describe(ctx) })
      engine = 'ai'
      summary = 'Drafted by your connected AI. Review before using.'
    } catch (e) {
      output = def.template(ctx)
      summary = `AI was unavailable (${e instanceof Error ? e.message : 'error'}). Built-in template instead.`
    }
  } else {
    output = def.template(ctx)
  }
  const consequential = opts.consequential ?? def.consequential
  if (opts.taskId) {
    const t = store.get('tasks', opts.taskId)
    if (t && t.status === 'todo') store.update('tasks', t.id, { status: 'doing' })
  }
  return store.create('actions', {
    agentKey: opts.agentKey,
    skill: def.key,
    title: opts.title,
    summary,
    output,
    engine,
    consequential,
    state: consequential ? 'needs_approval' : 'draft',
    projectId: opts.projectId,
    areaId: opts.areaId,
    taskId: opts.taskId,
  })
}

/**
 * Carry out an approved action inside EMS. External sending is not connected,
 * so consequential actions are marked ready, with that stated plainly.
 */
export function executeAction(store: Store, action: AIAction): void {
  const def = SKILLS[action.skill]
  let note = def?.apply ? def.apply(store, action) : 'Saved.'
  if (action.consequential) note = 'Approved. Sending and publishing are not connected yet — copy the text to use it.'
  store.update('actions', action.id, { state: 'executed', executedNote: note })
  const task = action.taskId ? store.get('tasks', action.taskId) : undefined
  // A follow-up draft does not finish the thing being waited on.
  if (task && task.status !== 'waiting') store.update('tasks', task.id, { status: 'done', doneAt: new Date().toISOString() })
  if (action.projectId) {
    store.update('projects', action.projectId, { lastActivityAt: new Date().toISOString() })
    store.logProgress({ kind: 'project_advanced', title: action.title, projectId: action.projectId, areaId: store.get('projects', action.projectId)?.areaId })
  }
}
