// Core data model for the EMS.
// Code uses technical names; the interface translates them into D'Andrea's
// language through domain/labels.ts.

export type ID = string

/** Every stored record carries these fields. */
export interface BaseRecord {
  id: ID
  createdAt: string
  updatedAt: string
  /** True for seeded sample records, so the UI can mark them as demo data. */
  demo?: boolean
}

// ── Areas ───────────────────────────────────────────────────────────────────

export type AreaKind = 'personal' | 'organization' | 'standalone' | 'function' | 'system' | 'school'

/** A major part of D'Andrea's world. Areas never "complete". */
export interface Area extends BaseRecord {
  slug: string
  name: string
  kind: AreaKind
  tagline: string
  /** What this area supports: courses, sponsors, Substack, etc. */
  focuses: string[]
  color: string
  /** Areas this one feeds or draws from (used by the command center map). */
  connectedAreaIds: ID[]
  /** Free-form current state, written by D'Andrea or the assistant. */
  currentState?: string
}

/** Learning areas inside DBM Learning Institute. Only D'Andrea defines these. */
export interface LearningArea extends BaseRecord {
  areaId: ID
  name: string
  description?: string
}

// ── Work ────────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'idea'
  | 'planning'
  | 'active'
  | 'waiting'
  | 'paused'
  | 'needs_attention'
  | 'at_risk'
  | 'completed'
  | 'closed'
  | 'archived'
  | 'cancelled'

export type Cadence = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom'

/** Who does the work. UI: I DO IT / AI HELPS ME / AI DOES IT. */
export type WorkMode = 'me' | 'ai_helps' | 'ai_does'

export interface Project extends BaseRecord {
  name: string
  /** "What am I trying to accomplish?" */
  outcome: string
  areaId: ID
  status: ProjectStatus
  dueDate?: string
  cadence: Cadence
  notes?: string
  /** 0–100, how close to done. Set by milestones or by hand. */
  progress: number
  /** Last time anything meaningful happened. Drives "needs attention". */
  lastActivityAt: string
  goalId?: ID
  /** What is in the way, in plain words. */
  blocker?: string
  incomePotential?: 'none' | 'low' | 'medium' | 'high'
  finish?: ProjectFinish
}

/** Captured when D'Andrea finishes a project, so the history is kept. */
export interface ProjectFinish {
  accomplished: string
  results?: string
  income?: number
  impact?: string
  learned?: string
  next?: WhatComesNext
  reusable?: string
  finishedAt: string
}

export type WhatComesNext = 'build_on' | 'monetize' | 'repurpose' | 'promote' | 'create_new' | 'rest'

export interface Milestone extends BaseRecord {
  projectId: ID
  title: string
  dueDate?: string
  done: boolean
  doneAt?: string
}

export type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done'

export interface Task extends BaseRecord {
  title: string
  status: TaskStatus
  mode: WorkMode
  projectId?: ID
  areaId?: ID
  dueDate?: string
  /** Higher matters more. 1–5. */
  importance: number
  /** Who or what this is waiting on, when status is "waiting". */
  waitingOn?: string
  waitingSince?: string
  doneAt?: string
  /** Set when this task came from a capture or a "move forward" suggestion. */
  source?: 'capture' | 'assistant' | 'manual'
}

export interface OngoingWork extends BaseRecord {
  title: string
  areaId: ID
  cadence: Cadence
  mode: WorkMode
  lastDoneAt?: string
  notes?: string
}

export interface Goal extends BaseRecord {
  title: string
  areaId: ID
  target?: string
  metric?: string
  current?: number
  targetValue?: number
  dueDate?: string
}

export type Channel =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'youtube_shorts'
  | 'linkedin'
  | 'pinterest'
  | 'substack'
  | 'email'
  | 'podcast'

export interface Campaign extends BaseRecord {
  name: string
  areaId: ID
  projectId?: ID
  objective: string
  audience?: string
  message?: string
  offer?: string
  cta?: string
  channels: Channel[]
  startDate?: string
  endDate?: string
  status: 'planning' | 'active' | 'completed' | 'paused'
  metrics?: Record<string, number>
}

// ── Calendar ────────────────────────────────────────────────────────────────

export type EventKind =
  | 'appointment'
  | 'meeting'
  | 'event'
  | 'deadline'
  | 'milestone'
  | 'campaign'
  | 'personal'
  | 'wellness'
  | 'launch'
  | 'class'
  | 'exam'
  | 'clinical'

export interface CalendarEvent extends BaseRecord {
  title: string
  kind: EventKind
  start: string
  end?: string
  allDay?: boolean
  areaId?: ID
  projectId?: ID
  location?: string
  notes?: string
}

// ── Ideas & opportunities ───────────────────────────────────────────────────

export type IdeaVerdict = 'strong' | 'worth_exploring' | 'later' | 'low' | 'not_recommended'

export interface Idea extends BaseRecord {
  title: string
  description?: string
  areaId?: ID
  kind: 'idea' | 'opportunity'
  category?: 'business' | 'program' | 'product' | 'book' | 'content' | 'partnership' | 'other'
  status: 'new' | 'exploring' | 'decided' | 'became_project' | 'let_go'
  verdict?: IdeaVerdict
  /** Why the verdict, in plain words. */
  reasoning?: string
  /** Existing work this would build on. */
  buildsOnIds?: ID[]
  incomePotential?: 'none' | 'low' | 'medium' | 'high'
  effort?: 'small' | 'medium' | 'large'
  projectId?: ID
}

// ── Income ──────────────────────────────────────────────────────────────────

/** Never treat anything but "actual" as money in hand. */
export type IncomeCertainty = 'actual' | 'expected' | 'forecast' | 'estimate'

export interface IncomeEntry extends BaseRecord {
  label: string
  amount: number
  certainty: IncomeCertainty
  date: string
  areaId?: ID
  source: 'course' | 'book' | 'event' | 'speaking' | 'service' | 'product' | 'grant' | 'donation' | 'sponsorship' | 'membership' | 'other'
  offerId?: ID
}

export interface Offer extends BaseRecord {
  name: string
  kind: 'product' | 'service' | 'course' | 'book' | 'workshop' | 'membership' | 'event' | 'speaking'
  areaId: ID
  price?: number
  status: 'idea' | 'building' | 'live' | 'retired'
  description?: string
}

// ── Content & information ───────────────────────────────────────────────────

export interface ContentItem extends BaseRecord {
  title: string
  areaId?: ID
  channel?: Channel
  kind: 'post' | 'video' | 'short' | 'article' | 'email' | 'episode' | 'chapter' | 'lesson'
  status: 'idea' | 'draft' | 'needs_approval' | 'approved' | 'scheduled' | 'published'
  publishDate?: string
  body?: string
  campaignId?: ID
}

/** Books, workbooks, courses, curricula — things D'Andrea has made or is making. */
export interface Asset extends BaseRecord {
  title: string
  kind: 'book' | 'workbook' | 'course' | 'curriculum' | 'presentation' | 'training' | 'framework' | 'research' | 'video_series' | 'newsletter'
  areaId: ID
  status: 'idea' | 'in_progress' | 'complete'
  description?: string
}

export interface Contact extends BaseRecord {
  name: string
  role?: string
  organization?: string
  areaIds: ID[]
  email?: string
  notes?: string
}

export interface Note extends BaseRecord {
  title: string
  body: string
  areaId?: ID
  projectId?: ID
  kind: 'note' | 'meeting' | 'decision' | 'document' | 'sop' | 'brand' | 'research'
}

/**
 * Generic relationship between any two records. This is what lets the system
 * answer "show me everything related to Faith + Mental Health".
 */
export interface Link extends BaseRecord {
  fromType: EntityType
  fromId: ID
  toType: EntityType
  toId: ID
  relation: string
}

// ── Wellness ────────────────────────────────────────────────────────────────

export interface WellnessEntry extends BaseRecord {
  date: string
  movementMinutes?: number
  stretched?: boolean
  sleepHours?: number
  waterCups?: number
  /** 1–5 self check-in. Not a diagnosis. */
  energy?: number
  note?: string
}

// ── AI team ─────────────────────────────────────────────────────────────────

export interface Agent extends BaseRecord {
  key: string
  name: string
  purpose: string
  areaIds: ID[]
  /** Workflow keys this assistant can run. See ai/skills.ts. */
  skills: string[]
}

export type ActionState = 'draft' | 'needs_approval' | 'approved' | 'executed' | 'declined'

/**
 * Something an assistant prepared or did. Consequential actions must be
 * approved before they are executed.
 */
export interface AIAction extends BaseRecord {
  agentKey: string
  skill: string
  title: string
  summary?: string
  output?: string
  state: ActionState
  consequential: boolean
  projectId?: ID
  areaId?: ID
  taskId?: ID
  /** "builtin" = rule-based planner, "ai" = real model. Shown in the UI. */
  engine: 'builtin' | 'ai'
  executedNote?: string
}

export interface Notification extends BaseRecord {
  kind: 'needs_attention' | 'overdue' | 'waiting' | 'opportunity' | 'income' | 'completed' | 'next' | 'upcoming' | 'wellness' | 'approval'
  title: string
  body?: string
  href?: string
  read: boolean
}

/** Meaningful progress, shown in WHAT MOVED FORWARD. */
export interface ProgressEntry extends BaseRecord {
  kind: 'project_advanced' | 'milestone' | 'campaign_launched' | 'published' | 'completed' | 'income' | 'partnership' | 'decision' | 'restarted' | 'captured'
  title: string
  areaId?: ID
  projectId?: ID
  at: string
}

export interface Capture extends BaseRecord {
  text: string
  classifiedAs: CaptureType
  areaId?: ID
  createdRecord?: { type: EntityType; id: ID }
}

export type CaptureType = 'idea' | 'task' | 'reminder' | 'project' | 'contact' | 'note' | 'meeting' | 'content' | 'opportunity'

// ── Store shape ─────────────────────────────────────────────────────────────

export interface Collections {
  areas: Area
  learningAreas: LearningArea
  projects: Project
  milestones: Milestone
  tasks: Task
  ongoing: OngoingWork
  goals: Goal
  campaigns: Campaign
  events: CalendarEvent
  ideas: Idea
  income: IncomeEntry
  offers: Offer
  content: ContentItem
  assets: Asset
  contacts: Contact
  notes: Note
  links: Link
  wellness: WellnessEntry
  agents: Agent
  actions: AIAction
  notifications: Notification
  progress: ProgressEntry
  captures: Capture
}

export type CollectionName = keyof Collections

/** Singular entity names used in links and search results. */
export type EntityType =
  | 'area'
  | 'project'
  | 'task'
  | 'ongoing'
  | 'goal'
  | 'campaign'
  | 'event'
  | 'idea'
  | 'income'
  | 'offer'
  | 'content'
  | 'asset'
  | 'contact'
  | 'note'

export type DB = { [K in CollectionName]: Collections[K][] }
