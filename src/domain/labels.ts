// D'Andrea's language for everything the interface shows.
import type {
  ActionState,
  Cadence,
  Channel,
  CollectionName,
  EntityType,
  IdeaVerdict,
  IncomeCertainty,
  ProjectStatus,
  WhatComesNext,
  WorkMode,
} from './types'

export const MODE_LABEL: Record<WorkMode, string> = {
  me: 'I do it',
  ai_helps: 'AI helps me',
  ai_does: 'AI does it',
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: 'Idea',
  planning: 'Planning',
  active: 'Active',
  waiting: 'Waiting',
  paused: 'Paused',
  needs_attention: 'Needs attention',
  at_risk: 'At risk',
  completed: 'Completed',
  closed: 'Closed',
  archived: 'Archived',
  cancelled: 'Cancelled',
}

/** Statuses that mean the project is still in play. */
export const OPEN_STATUSES: ProjectStatus[] = ['idea', 'planning', 'active', 'waiting', 'paused', 'needs_attention', 'at_risk']

export const CADENCE_LABEL: Record<Cadence, string> = {
  none: 'No set schedule',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  custom: 'Custom',
}

export const CERTAINTY_LABEL: Record<IncomeCertainty, string> = {
  actual: 'Received',
  expected: 'Expected',
  forecast: 'Forecast',
  estimate: 'Estimate',
}

export const VERDICT_LABEL: Record<IdeaVerdict, string> = {
  strong: 'Strong opportunity',
  worth_exploring: 'Worth exploring',
  later: 'Good later',
  low: 'Low priority',
  not_recommended: 'Not recommended',
}

export const NEXT_LABEL: Record<WhatComesNext, { title: string; hint: string }> = {
  build_on: { title: 'Build on it', hint: 'Keep expanding what you just finished.' },
  monetize: { title: 'Monetize it', hint: 'Find ways for it to produce income.' },
  repurpose: { title: 'Repurpose it', hint: 'Turn it into content, a course, a product.' },
  promote: { title: 'Promote it', hint: 'Plan a campaign so people see it.' },
  create_new: { title: 'Create something new', hint: 'Explore a new opportunity.' },
  rest: { title: 'Let it rest', hint: 'Nothing needed right now.' },
}

export const ACTION_STATE_LABEL: Record<ActionState, string> = {
  draft: 'Draft',
  needs_approval: 'Needs your approval',
  approved: 'Approved',
  executed: 'Done',
  declined: 'Declined',
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  youtube_shorts: 'YouTube Shorts',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  substack: 'Substack',
  email: 'Email',
  podcast: 'Podcast',
}

export const ENTITY_LABEL: Record<EntityType, string> = {
  area: 'Area',
  project: 'Project',
  task: 'To-do',
  ongoing: 'Ongoing work',
  goal: 'Goal',
  campaign: 'Campaign',
  event: 'Calendar',
  idea: 'Idea',
  income: 'Income',
  offer: 'Offer',
  content: 'Content',
  asset: 'Book / course / material',
  contact: 'Person',
  note: 'Note',
}

export const ENTITY_COLLECTION: Record<EntityType, CollectionName> = {
  area: 'areas',
  project: 'projects',
  task: 'tasks',
  ongoing: 'ongoing',
  goal: 'goals',
  campaign: 'campaigns',
  event: 'events',
  idea: 'ideas',
  income: 'income',
  offer: 'offers',
  content: 'content',
  asset: 'assets',
  contact: 'contacts',
  note: 'notes',
}
