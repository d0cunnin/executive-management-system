// Which assistant takes a to-do. The AI reads the to-do (title, her notes,
// area and project) and picks from the list below. If the AI can't be
// reached or answers with something not on the list, keyword matching
// decides instead, as before.
import type { Store } from '../data/store'
import type { AIAction, DB, Task } from '../domain/types'
import { areaOf, skillForTask } from './intelligence'
import type { AIProvider } from './provider'
import { runSkill } from './skills'

export interface Route {
  skill: string
  agentKey: string
  /** Public or external: the draft waits for her approval. */
  consequential: boolean
  when: string
}

export const ROUTES: Route[] = [
  { skill: 'social_posts', agentKey: 'social', consequential: true, when: 'social media posts, captions, reels' },
  { skill: 'draft_email', agentKey: 'marketing', consequential: true, when: 'an email or newsletter to an audience or list' },
  { skill: 'draft_follow_up', agentKey: 'admin', consequential: true, when: 'a message, request, invitation or follow-up to a specific person or organization' },
  { skill: 'draft_announcement', agentKey: 'ministry', consequential: true, when: 'a church announcement' },
  { skill: 'campaign_strategy', agentKey: 'marketing', consequential: false, when: 'marketing or campaign strategy and planning' },
  { skill: 'course_outline', agentKey: 'course', consequential: false, when: 'course, lesson, module or curriculum content' },
  { skill: 'research_brief', agentKey: 'research', consequential: false, when: 'researching, finding or comparing options, people, places or information' },
  { skill: 'grant_prep', agentKey: 'nonprofit', consequential: false, when: 'grants, funding applications, nonprofit budgets' },
  { skill: 'event_runsheet', agentKey: 'event', consequential: false, when: 'planning or running an event' },
  { skill: 'launch_checklist', agentKey: 'publishing', consequential: false, when: 'publishing or launching a book or workbook' },
  { skill: 'study_plan', agentKey: 'study', consequential: false, when: 'nursing school studying, exams, clinicals' },
  { skill: 'ministry_plan', agentKey: 'ministry', consequential: false, when: 'church or ministry planning' },
  { skill: 'evaluate_idea', agentKey: 'business', consequential: false, when: 'deciding whether a business idea or opportunity is worth pursuing' },
  { skill: 'monetize_assets', agentKey: 'business', consequential: false, when: 'finding income in existing work, content or intellectual property' },
  { skill: 'prep_appointments', agentKey: 'personal', consequential: false, when: 'preparing for personal appointments' },
  { skill: 'weekly_review', agentKey: 'executive', consequential: false, when: 'reviews, reports, summaries, organizing' },
  { skill: 'draft_outline', agentKey: 'writing', consequential: false, when: 'any other writing: an outline or first draft' },
]

/** Pull a listed skill key out of the AI's reply. */
export function parseRoute(reply: string): Route | undefined {
  const words = reply.toLowerCase().match(/[a-z_]+/g) ?? []
  return words.map((w) => ROUTES.find((r) => r.skill === w)).find(Boolean)
}

export async function chooseRoute(provider: AIProvider, db: DB, t: Task): Promise<Route & { chosenBy: 'ai' | 'keywords' }> {
  const fallback = skillForTask(t)
  const byKeywords = { ...(ROUTES.find((r) => r.skill === fallback.skill) ?? ROUTES[ROUTES.length - 1]), ...fallback, chosenBy: 'keywords' as const }
  if (!provider.connected) return byKeywords
  const project = db.projects.find((p) => p.id === t.projectId)
  try {
    const reply = await provider.generate({
      agentKey: 'executive',
      instruction: [
        'Choose which assistant should prepare this to-do. Reply with only the key from the list, nothing else.',
        ...ROUTES.map((r) => `${r.skill} — ${r.when}`),
      ].join('\n'),
      context: [
        `To-do: ${t.title}`,
        t.notes && `Her notes: ${t.notes}`,
        areaOf(db, t.areaId) && `Area: ${areaOf(db, t.areaId)?.name}`,
        project && `Project: ${project.name} — ${project.outcome}`,
      ].filter(Boolean).join('\n'),
    })
    const route = parseRoute(reply)
    if (!route) return byKeywords
    // Never less careful than the keywords: if either says it goes public, it waits for approval.
    return { ...route, consequential: route.consequential || fallback.consequential, chosenBy: 'ai' }
  } catch {
    return byKeywords
  }
}

/** "Do it" for a to-do: pick the right assistant, then draft. */
export async function runTask(store: Store, provider: AIProvider, t: Task): Promise<AIAction> {
  const route = await chooseRoute(provider, store.snapshot(), t)
  return runSkill(store, provider, { skill: route.skill, agentKey: route.agentKey, consequential: route.consequential, title: t.title, projectId: t.projectId, areaId: t.areaId, taskId: t.id })
}
