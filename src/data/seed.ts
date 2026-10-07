// Representative sample data, built relative to today so the demo always looks
// current. Every record is flagged `demo: true` and shown as sample data.
// Nothing here is real personal information.
import type { Agent, Area, DB, ID } from '../domain/types'
import { dayOffset, nowIso } from '../lib/util'

const stamp = () => ({ createdAt: nowIso(), updatedAt: nowIso(), demo: true })
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

export const AREA_IDS = {
  personal: 'area_personal',
  dbm: 'area_dbm',
  summit: 'area_summit',
  ark: 'area_ark',
  becoming: 'area_becoming',
  stv: 'area_stv',
  church: 'area_church',
  books: 'area_books',
  business: 'area_business',
  content: 'area_content',
  ideas: 'area_ideas',
  team: 'area_team',
  wellness: 'area_wellness',
} as const

const A = AREA_IDS

function area(id: ID, slug: string, name: string, kind: Area['kind'], color: string, tagline: string, focuses: string[], connected: ID[]): Area {
  return { id, slug, name, kind, color, tagline, focuses, connectedAreaIds: connected, ...stamp(), demo: false }
}

export const AREAS: Area[] = [
  area(A.personal, 'personal', 'Personal', 'personal', '#f0abfc', 'Calendar, appointments, life admin',
    ['Calendar', 'Appointments', 'Personal tasks', 'Personal administration', 'Reminders', 'Life responsibilities'], [A.wellness]),
  area(A.dbm, 'dbm', 'DBM Learning Institute', 'organization', '#818cf8', 'Five learning areas, courses, students, certifications',
    ['Courses', 'Learning areas', 'Students', 'Curriculum', 'Assessments', 'Certifications', 'Course launches', 'Enrollment', 'Student experience'],
    [A.summit, A.books, A.business, A.content]),
  area(A.summit, 'summit', 'Faith + Mental Health Summit', 'standalone', '#c084fc', 'The annual summit — speakers, registration, sponsors',
    ['Annual summit', 'Speakers', 'Registration', 'Sponsors', 'Vendors', 'Marketing', 'Event operations', 'Attendees', 'Follow-up'],
    [A.dbm, A.content, A.business]),
  area(A.ark, 'build-your-ark', 'Build Your Ark', 'standalone', '#38bdf8', 'Book/manual, Substack, preparation resources',
    ['Book / manual', 'Substack', 'Preparation resources', 'Products', 'Community', 'Events', 'Sales'],
    [A.books, A.content, A.business]),
  area(A.becoming, 'becoming-her', 'Becoming Her', 'standalone', '#f472b6', 'Discipleship, mentorship, workbook',
    ['Discipleship', 'Mentorship', 'Curriculum', 'Workbook', 'Participants', 'Events', 'Resources'],
    [A.books, A.church, A.content]),
  area(A.stv, 'steps-to-victory', 'Steps to Victory', 'organization', '#34d399', 'STEM and youth programs, Road to Tech, funding',
    ['STEM programs', 'Youth programs', 'Road to Tech', 'STEM Innovation Team', 'Grants', 'Capital campaign', 'Partnerships', 'Program evaluation'],
    [A.business, A.content]),
  area(A.church, 'sockzoo', 'SOCCKZOO', 'organization', '#fbbf24', 'Church calendar, ministry teams, communications',
    ['Church calendar', 'Ministry teams', 'Programs', 'Meetings', 'Events', 'Communications', 'Volunteers', 'Ministry planning'],
    [A.becoming]),
  area(A.books, 'books', 'Books + Publishing', 'function', '#a5b4fc', 'Manuscripts, editing, publishing, launches',
    ['Books', 'Workbooks', 'Manuscripts', 'Research', 'Editing', 'Publishing', 'Book launches', 'Sales'],
    [A.ark, A.becoming, A.dbm, A.business]),
  area(A.business, 'business', 'Business + Income', 'function', '#facc15', 'Products, services, speaking, income',
    ['Products', 'Services', 'Courses', 'Workshops', 'Speaking', 'Memberships', 'Partnerships', 'Forecasting'],
    [A.ideas]),
  area(A.content, 'content', 'Content + Media', 'function', '#fb7185', 'YouTube, podcast, social, Substack, email',
    ['YouTube', 'YouTube Shorts', 'Podcast', 'Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Substack', 'Email', 'Content calendar'],
    [A.business]),
  area(A.ideas, 'ideas', 'Ideas + Opportunities', 'system', '#5eead4', 'Things you might build, teach, or sell', ['Ideas', 'Opportunities'], [A.business]),
  area(A.team, 'ai-team', 'My AI Team', 'system', '#93c5fd', 'Your assistants and what they are doing', ['Assistants', 'Approvals', 'Activity'], []),
  area(A.wellness, 'wellness', 'Wellness', 'personal', '#86efac', 'Movement, rest, consistency', ['Movement', 'Stretching', 'Sleep', 'Hydration', 'Check-ins', 'Recovery'], [A.personal]),
]

export const AGENTS: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { key: 'executive', name: 'Executive Assistant', purpose: 'Sees the whole picture and helps you decide what matters.', areaIds: [], skills: ['daily_brief', 'weekly_review', 'monthly_review', 'quarterly_review', 'what_next', 'needs_attention_scan'] },
  { key: 'personal', name: 'Personal Assistant', purpose: 'Keeps personal admin and appointments organized.', areaIds: [A.personal], skills: ['organize_captures', 'prep_appointments'] },
  { key: 'project', name: 'Project Assistant', purpose: 'Moves projects forward and finds what is blocking them.', areaIds: [], skills: ['move_forward', 'break_down_project', 'finish_project'] },
  { key: 'admin', name: 'Administrative Assistant', purpose: 'Follow-ups, documents, recurring admin.', areaIds: [], skills: ['draft_follow_up', 'waiting_on_review'] },
  { key: 'marketing', name: 'Marketing Assistant', purpose: 'Builds campaign strategy grounded in audience and offer.', areaIds: [A.content], skills: ['campaign_strategy', 'draft_email'] },
  { key: 'social', name: 'Social Media Assistant', purpose: 'Writes platform-specific posts, never one copy pasted everywhere.', areaIds: [A.content], skills: ['social_posts', 'repurpose'] },
  { key: 'business', name: 'Business Assistant', purpose: 'Finds income in what you already have.', areaIds: [A.business], skills: ['monetize_assets', 'evaluate_idea'] },
  { key: 'research', name: 'Research Assistant', purpose: 'Researches topics with current, cited sources.', areaIds: [], skills: ['research_brief'] },
  { key: 'writing', name: 'Writing Assistant', purpose: 'Drafts written materials in your voice.', areaIds: [A.books], skills: ['draft_outline'] },
  { key: 'course', name: 'Course Assistant', purpose: 'Develops and manages courses.', areaIds: [A.dbm], skills: ['course_outline'] },
  { key: 'publishing', name: 'Publishing Assistant', purpose: 'Books, editing, publishing, launches.', areaIds: [A.books], skills: ['launch_checklist'] },
  { key: 'event', name: 'Event Assistant', purpose: 'Plans and runs events.', areaIds: [A.summit], skills: ['event_runsheet'] },
  { key: 'nonprofit', name: 'Nonprofit Assistant', purpose: 'Supports Steps to Victory programs and funding.', areaIds: [A.stv], skills: ['grant_prep'] },
  { key: 'ministry', name: 'Ministry Assistant', purpose: 'Supports SOCCKZOO planning and communications.', areaIds: [A.church], skills: ['ministry_plan', 'draft_announcement'] },
  { key: 'wellness', name: 'Wellness Assistant', purpose: 'Encourages movement, rest, and consistency.', areaIds: [A.wellness], skills: ['wellness_check'] },
]

export function buildSeed(): DB {
  const s = stamp
  return {
    areas: AREAS,
    learningAreas: [
      { id: 'la_fmh', areaId: A.dbm, name: 'Faith + Mental Health', description: 'One of the five DBM learning areas.', ...s(), demo: false },
    ],
    goals: [
      { id: 'goal_summit_reg', title: 'Grow Summit registrations', areaId: A.summit, metric: 'Registrations', current: 112, targetValue: 300, dueDate: dayOffset(68), ...s() },
      { id: 'goal_dbm_enroll', title: 'Increase DBM enrollment', areaId: A.dbm, metric: 'New students this quarter', current: 18, targetValue: 50, ...s() },
      { id: 'goal_publish', title: 'Publish the Becoming Her workbook', areaId: A.becoming, ...s() },
    ],
    projects: [
      { id: 'p_bh_workbook', name: 'Finish the Becoming Her workbook', outcome: 'A finished workbook participants can use in the next cohort.', areaId: A.becoming, status: 'active', cadence: 'none', dueDate: dayOffset(21), progress: 78, lastActivityAt: ago(2), goalId: 'goal_publish', incomePotential: 'medium', ...s() },
      { id: 'p_summit_reg', name: 'Summit registration campaign', outcome: 'Reach 300 registrations before the Summit.', areaId: A.summit, status: 'needs_attention', cadence: 'none', dueDate: dayOffset(60), progress: 35, lastActivityAt: ago(9), goalId: 'goal_summit_reg', blocker: 'Campaign message has not been approved.', incomePotential: 'high', ...s() },
      { id: 'p_summit_speakers', name: 'Confirm Summit speakers', outcome: 'Full speaker lineup confirmed and announced.', areaId: A.summit, status: 'active', cadence: 'none', dueDate: dayOffset(30), progress: 70, lastActivityAt: ago(1), ...s() },
      { id: 'p_fmh101', name: 'Build Faith + Mental Health 101 course', outcome: 'An enrollable DBM course with lessons, workbook, and assessment.', areaId: A.dbm, status: 'active', cadence: 'none', progress: 45, lastActivityAt: ago(5), goalId: 'goal_dbm_enroll', incomePotential: 'high', ...s() },
      { id: 'p_ark_book', name: 'Build Your Ark manual — first draft', outcome: 'A complete first draft ready for editing.', areaId: A.ark, status: 'active', cadence: 'none', progress: 55, lastActivityAt: ago(4), incomePotential: 'medium', ...s() },
      { id: 'p_stv_grant', name: 'STEM program grant application', outcome: 'Submit a strong application for Road to Tech funding.', areaId: A.stv, status: 'waiting', cadence: 'none', dueDate: dayOffset(12), progress: 60, lastActivityAt: ago(6), blocker: 'Waiting on program budget from the treasurer.', incomePotential: 'high', ...s() },
      { id: 'p_stv_capital', name: 'Capital campaign plan', outcome: 'A clear plan, goal, and donor list for the capital campaign.', areaId: A.stv, status: 'paused', cadence: 'none', progress: 15, lastActivityAt: ago(31), ...s() },
      { id: 'p_church_fall', name: 'Fall ministry calendar', outcome: 'Every ministry team knows its fall dates.', areaId: A.church, status: 'planning', cadence: 'none', dueDate: dayOffset(9), progress: 40, lastActivityAt: ago(3), ...s() },
      { id: 'p_website', name: 'New personal website', outcome: 'One home for books, speaking, courses, and the Summit.', areaId: A.business, status: 'idea', cadence: 'none', progress: 0, lastActivityAt: ago(40), incomePotential: 'medium', ...s() },
      { id: 'p_substack_series', name: 'Build Your Ark Substack series', outcome: 'A 6-part series that grows the list ahead of the manual.', areaId: A.ark, status: 'active', cadence: 'weekly', progress: 50, lastActivityAt: ago(7), ...s() },
      { id: 'p_retreat_done', name: 'Becoming Her spring gathering', outcome: 'Host the spring gathering.', areaId: A.becoming, status: 'completed', cadence: 'none', progress: 100, lastActivityAt: ago(45),
        finish: { accomplished: 'Hosted the spring gathering.', results: 'Strong attendance and great feedback (sample).', learned: 'Participants asked for a workbook to continue at home.', next: 'build_on', reusable: 'Session talks and handouts', finishedAt: ago(45) }, ...s() },
    ],
    milestones: [
      { id: 'm1', projectId: 'p_bh_workbook', title: 'Sections 1–5 drafted', done: true, doneAt: ago(10), ...s() },
      { id: 'm2', projectId: 'p_bh_workbook', title: 'Section 6 drafted', done: false, dueDate: dayOffset(4), ...s() },
      { id: 'm3', projectId: 'p_bh_workbook', title: 'Design and layout', done: false, dueDate: dayOffset(14), ...s() },
      { id: 'm4', projectId: 'p_summit_reg', title: 'Campaign message approved', done: false, dueDate: dayOffset(2), ...s() },
      { id: 'm5', projectId: 'p_summit_reg', title: 'Early-bird email sent', done: false, dueDate: dayOffset(7), ...s() },
      { id: 'm6', projectId: 'p_fmh101', title: 'Course outline final', done: true, doneAt: ago(12), ...s() },
      { id: 'm7', projectId: 'p_fmh101', title: 'Lessons 1–4 recorded', done: false, dueDate: dayOffset(20), ...s() },
      { id: 'm8', projectId: 'p_stv_grant', title: 'Budget section complete', done: false, dueDate: dayOffset(8), ...s() },
    ],
    tasks: [
      { id: 't1', title: 'Approve the Summit campaign message', status: 'todo', mode: 'me', projectId: 'p_summit_reg', areaId: A.summit, dueDate: dayOffset(1), importance: 5, ...s() },
      { id: 't2', title: 'Write Becoming Her section 6 reflection', status: 'doing', mode: 'me', projectId: 'p_bh_workbook', areaId: A.becoming, dueDate: dayOffset(3), importance: 5, ...s() },
      { id: 't3', title: 'Draft next 7 Summit social posts', status: 'todo', mode: 'ai_helps', projectId: 'p_summit_reg', areaId: A.summit, importance: 4, ...s() },
      { id: 't4', title: 'Draft early-bird registration email', status: 'todo', mode: 'ai_helps', projectId: 'p_summit_reg', areaId: A.summit, dueDate: dayOffset(5), importance: 4, ...s() },
      { id: 't5', title: 'Organize this week\'s captured notes', status: 'todo', mode: 'ai_does', importance: 2, ...s() },
      { id: 't6', title: 'Program budget for grant', status: 'waiting', mode: 'me', projectId: 'p_stv_grant', areaId: A.stv, waitingOn: 'Treasurer', waitingSince: ago(6), importance: 5, ...s() },
      { id: 't7', title: 'Speaker bio and headshot', status: 'waiting', mode: 'me', projectId: 'p_summit_speakers', areaId: A.summit, waitingOn: 'Keynote speaker (sample)', waitingSince: ago(4), importance: 3, ...s() },
      { id: 't8', title: 'Outline lessons 5–8 for FMH 101', status: 'todo', mode: 'ai_helps', projectId: 'p_fmh101', areaId: A.dbm, importance: 3, ...s() },
      { id: 't9', title: 'Send ministry leaders the fall date request', status: 'todo', mode: 'ai_helps', projectId: 'p_church_fall', areaId: A.church, dueDate: dayOffset(2), importance: 4, ...s() },
      { id: 't10', title: 'Prepare weekly review', status: 'todo', mode: 'ai_does', importance: 2, ...s() },
      { id: 't11', title: 'Renew car registration', status: 'todo', mode: 'me', areaId: A.personal, dueDate: dayOffset(6), importance: 3, ...s() },
      { id: 't12', title: 'Edit Ark chapter 4', status: 'todo', mode: 'me', projectId: 'p_ark_book', areaId: A.ark, importance: 3, ...s() },
      { id: 't13', title: 'Sections 1–5 drafted', status: 'done', mode: 'me', projectId: 'p_bh_workbook', doneAt: ago(10), importance: 4, ...s() },
      { id: 't14', title: 'Confirm two breakout speakers', status: 'done', mode: 'me', projectId: 'p_summit_speakers', doneAt: ago(1), importance: 4, ...s() },
      { id: 't15', title: 'Sign permission forms', status: 'waiting', mode: 'me', areaId: A.stv, waitingOn: 'Partner school (sample)', waitingSince: ago(12), importance: 3, ...s() },
    ],
    ongoing: [
      { id: 'o1', title: 'Weekly social content', areaId: A.content, cadence: 'weekly', mode: 'ai_helps', lastDoneAt: ago(8), ...s() },
      { id: 'o2', title: 'Student support check-in', areaId: A.dbm, cadence: 'weekly', mode: 'me', lastDoneAt: ago(3), ...s() },
      { id: 'o3', title: 'Grant research', areaId: A.stv, cadence: 'monthly', mode: 'ai_helps', lastDoneAt: ago(20), ...s() },
      { id: 'o4', title: 'Church administration', areaId: A.church, cadence: 'weekly', mode: 'me', lastDoneAt: ago(5), ...s() },
      { id: 'o5', title: 'Financial review', areaId: A.business, cadence: 'monthly', mode: 'ai_helps', lastDoneAt: ago(35), ...s() },
      { id: 'o6', title: 'Substack post', areaId: A.ark, cadence: 'weekly', mode: 'ai_helps', lastDoneAt: ago(7), ...s() },
      { id: 'o7', title: 'Morning movement', areaId: A.wellness, cadence: 'daily', mode: 'me', lastDoneAt: ago(1), ...s() },
    ],
    campaigns: [
      { id: 'c_summit', name: 'Summit registration', areaId: A.summit, projectId: 'p_summit_reg', objective: 'Registrations', audience: 'Faith leaders, counselors, and church members who care about mental health', message: 'Faith and mental health belong in the same conversation.', offer: 'Early-bird registration', cta: 'Register now', channels: ['instagram', 'facebook', 'email', 'linkedin'], startDate: dayOffset(-14), endDate: dayOffset(60), status: 'active', metrics: { reach: 8400, engagementRate: 3.1, clicks: 260, registrations: 112 }, ...s() },
      { id: 'c_fmh_launch', name: 'FMH 101 course launch', areaId: A.dbm, projectId: 'p_fmh101', objective: 'Enrollment', channels: ['email', 'instagram', 'youtube'], status: 'planning', ...s() },
    ],
    events: [
      { id: 'e1', title: 'Summit planning call', kind: 'meeting', start: dayOffset(0, 10), end: dayOffset(0, 11), areaId: A.summit, ...s() },
      { id: 'e2', title: 'Dentist appointment', kind: 'appointment', start: dayOffset(0, 14, 30), areaId: A.personal, ...s() },
      { id: 'e3', title: 'Walk + stretch', kind: 'wellness', start: dayOffset(0, 7), areaId: A.wellness, ...s() },
      { id: 'e4', title: 'Ministry leaders meeting', kind: 'meeting', start: dayOffset(2, 18), areaId: A.church, ...s() },
      { id: 'e5', title: 'Grant application due', kind: 'deadline', start: dayOffset(12), allDay: true, areaId: A.stv, projectId: 'p_stv_grant', ...s() },
      { id: 'e6', title: 'Becoming Her section 6 due', kind: 'milestone', start: dayOffset(4), allDay: true, areaId: A.becoming, projectId: 'p_bh_workbook', ...s() },
      { id: 'e7', title: 'Early-bird registration ends', kind: 'campaign', start: dayOffset(14), allDay: true, areaId: A.summit, projectId: 'p_summit_reg', ...s() },
      { id: 'e8', title: 'Road to Tech session', kind: 'event', start: dayOffset(5, 16), areaId: A.stv, ...s() },
      { id: 'e9', title: 'Faith + Mental Health Summit', kind: 'event', start: dayOffset(68), allDay: true, areaId: A.summit, ...s() },
      { id: 'e10', title: 'Sunday service', kind: 'event', start: dayOffset(((7 - new Date().getDay()) % 7) || 7, 10), areaId: A.church, ...s() },
      { id: 'e11', title: 'Yoga class', kind: 'wellness', start: dayOffset(3, 8), areaId: A.wellness, ...s() },
    ],
    ideas: [
      { id: 'i_cert', title: 'Faith + Mental Health certification', description: 'A certification for church leaders built from the FMH course and Summit talks.', areaId: A.dbm, kind: 'idea', category: 'program', status: 'exploring', incomePotential: 'high', effort: 'large', buildsOnIds: ['as_fmh101', 'as_summit_talks'], ...s() },
      { id: 'i_ark_kit', title: 'Build Your Ark preparation kit', description: 'Printable checklists and planners sold alongside the manual.', areaId: A.ark, kind: 'idea', category: 'product', status: 'new', incomePotential: 'medium', effort: 'small', buildsOnIds: ['as_ark_manual'], ...s() },
      { id: 'i_bh_workshop', title: 'Becoming Her one-day workshop', description: 'Teach the workbook in a single day for churches.', areaId: A.becoming, kind: 'idea', category: 'program', status: 'new', incomePotential: 'medium', effort: 'medium', buildsOnIds: ['as_bh_workbook'], ...s() },
      { id: 'i_stem_partner', title: 'Partner with a local tech company for Road to Tech', areaId: A.stv, kind: 'opportunity', category: 'partnership', status: 'new', incomePotential: 'medium', effort: 'medium', ...s() },
      { id: 'i_podcast', title: 'Faith + Mental Health podcast', areaId: A.content, kind: 'idea', category: 'content', status: 'new', incomePotential: 'low', effort: 'large', ...s() },
    ],
    offers: [
      { id: 'of_fmh101', name: 'Faith + Mental Health 101', kind: 'course', areaId: A.dbm, price: 197, status: 'building', ...s() },
      { id: 'of_summit', name: 'Summit registration', kind: 'event', areaId: A.summit, price: 89, status: 'live', ...s() },
      { id: 'of_speaking', name: 'Keynote speaking', kind: 'speaking', areaId: A.business, status: 'live', ...s() },
      { id: 'of_bh_workbook', name: 'Becoming Her workbook', kind: 'book', areaId: A.becoming, price: 24, status: 'building', ...s() },
    ],
    income: [
      { id: 'in1', label: 'Summit registrations (to date)', amount: 9968, certainty: 'actual', date: dayOffset(-3), areaId: A.summit, source: 'event', offerId: 'of_summit', ...s() },
      { id: 'in2', label: 'Church workshop speaking fee', amount: 750, certainty: 'actual', date: dayOffset(-11), areaId: A.business, source: 'speaking', offerId: 'of_speaking', ...s() },
      { id: 'in3', label: 'Summit sponsorship (verbal yes)', amount: 2500, certainty: 'expected', date: dayOffset(20), areaId: A.summit, source: 'sponsorship', ...s() },
      { id: 'in4', label: 'Road to Tech grant', amount: 15000, certainty: 'forecast', date: dayOffset(75), areaId: A.stv, source: 'grant', ...s() },
      { id: 'in5', label: 'FMH 101 first cohort', amount: 4900, certainty: 'estimate', date: dayOffset(90), areaId: A.dbm, source: 'course', offerId: 'of_fmh101', ...s() },
      { id: 'in6', label: 'Build Your Ark Substack (paid subs)', amount: 310, certainty: 'actual', date: dayOffset(-1), areaId: A.ark, source: 'membership', ...s() },
    ],
    content: [
      { id: 'ct1', title: 'Why the church needs to talk about anxiety', areaId: A.summit, channel: 'instagram', kind: 'post', status: 'published', publishDate: dayOffset(-5), campaignId: 'c_summit', ...s() },
      { id: 'ct2', title: 'Ark Substack #3: Start with water', areaId: A.ark, channel: 'substack', kind: 'article', status: 'published', publishDate: dayOffset(-7), ...s() },
      { id: 'ct3', title: 'Summit speaker spotlight', areaId: A.summit, channel: 'facebook', kind: 'post', status: 'draft', campaignId: 'c_summit', ...s() },
      { id: 'ct4', title: 'Ark Substack #4', areaId: A.ark, channel: 'substack', kind: 'article', status: 'idea', publishDate: dayOffset(1), ...s() },
    ],
    assets: [
      { id: 'as_bh_workbook', title: 'Becoming Her workbook', kind: 'workbook', areaId: A.becoming, status: 'in_progress', ...s() },
      { id: 'as_ark_manual', title: 'Build Your Ark manual', kind: 'book', areaId: A.ark, status: 'in_progress', ...s() },
      { id: 'as_fmh101', title: 'Faith + Mental Health 101 curriculum', kind: 'course', areaId: A.dbm, status: 'in_progress', ...s() },
      { id: 'as_summit_talks', title: 'Past Summit talks', kind: 'video_series', areaId: A.summit, status: 'complete', description: 'Recorded sessions from previous Summits.', ...s() },
      { id: 'as_ark_substack', title: 'Build Your Ark Substack archive', kind: 'newsletter', areaId: A.ark, status: 'complete', ...s() },
      { id: 'as_bh_talks', title: 'Becoming Her spring gathering talks', kind: 'presentation', areaId: A.becoming, status: 'complete', ...s() },
      { id: 'as_r2t', title: 'Road to Tech curriculum', kind: 'curriculum', areaId: A.stv, status: 'complete', ...s() },
    ],
    contacts: [
      { id: 'pc1', name: 'Summit keynote speaker (sample)', role: 'Speaker', areaIds: [A.summit], ...s() },
      { id: 'pc2', name: 'Steps to Victory treasurer (sample)', role: 'Treasurer', areaIds: [A.stv], ...s() },
      { id: 'pc3', name: 'Ministry team lead (sample)', role: 'Ministry lead', areaIds: [A.church], ...s() },
    ],
    notes: [
      { id: 'n1', title: 'Summit debrief from last year', body: 'Registrations spiked after speaker announcements. Email outperformed social for conversions. (sample)', areaId: A.summit, kind: 'meeting', ...s() },
      { id: 'n2', title: 'Brand voice', body: 'Warm, direct, faith-rooted, practical. Speaks to the whole person. (sample)', kind: 'brand', ...s() },
      { id: 'n3', title: 'Decision: FMH 101 price', body: 'Launch price set at $197 for the first cohort. (sample)', areaId: A.dbm, projectId: 'p_fmh101', kind: 'decision', ...s() },
    ],
    links: [
      { id: 'l1', fromType: 'asset', fromId: 'as_fmh101', toType: 'project', toId: 'p_fmh101', relation: 'built in', ...s() },
      { id: 'l2', fromType: 'asset', fromId: 'as_fmh101', toType: 'offer', toId: 'of_fmh101', relation: 'sold as', ...s() },
      { id: 'l3', fromType: 'asset', fromId: 'as_summit_talks', toType: 'idea', toId: 'i_cert', relation: 'could feed', ...s() },
      { id: 'l4', fromType: 'asset', fromId: 'as_fmh101', toType: 'idea', toId: 'i_cert', relation: 'could feed', ...s() },
      { id: 'l5', fromType: 'campaign', fromId: 'c_summit', toType: 'offer', toId: 'of_summit', relation: 'promotes', ...s() },
      { id: 'l6', fromType: 'asset', fromId: 'as_ark_manual', toType: 'asset', toId: 'as_ark_substack', relation: 'shares material with', ...s() },
      { id: 'l7', fromType: 'asset', fromId: 'as_bh_workbook', toType: 'offer', toId: 'of_bh_workbook', relation: 'sold as', ...s() },
      { id: 'l8', fromType: 'asset', fromId: 'as_bh_talks', toType: 'asset', toId: 'as_bh_workbook', relation: 'inspired', ...s() },
    ],
    wellness: [
      ...[6, 5, 4, 3, 2, 1].map((d, i) => ({
        id: `w${d}`,
        date: dayOffset(-d),
        movementMinutes: [30, 0, 20, 45, 0, 25][i],
        stretched: [true, false, true, true, false, true][i],
        sleepHours: [7, 6, 6.5, 7.5, 5.5, 6][i],
        waterCups: [6, 4, 7, 8, 3, 5][i],
        energy: [4, 3, 3, 4, 2, 3][i],
        ...s(),
      })),
    ],
    agents: AGENTS.map((a) => ({ ...a, id: `agent_${a.key}`, ...s(), demo: false })),
    actions: [
      { id: 'act1', agentKey: 'social', skill: 'social_posts', title: 'Summit speaker spotlight — Facebook post', summary: 'Template draft prepared by the built-in planner.', state: 'needs_approval', consequential: true, projectId: 'p_summit_reg', areaId: A.summit, engine: 'builtin', output: 'Draft structure:\n• Hook: one sentence on why this speaker matters to faith leaders\n• Two lines on the session topic\n• CTA: Register for the Summit (link)\n\nFill in the speaker details before approving.', ...s() },
    ],
    notifications: [],
    progress: [
      { id: 'pr1', kind: 'milestone', title: 'Becoming Her sections 1–5 drafted', areaId: A.becoming, projectId: 'p_bh_workbook', at: ago(10), ...s() },
      { id: 'pr2', kind: 'project_advanced', title: 'Two Summit breakout speakers confirmed', areaId: A.summit, projectId: 'p_summit_speakers', at: ago(1), ...s() },
      { id: 'pr3', kind: 'published', title: 'Ark Substack #3 published', areaId: A.ark, at: ago(7), ...s() },
      { id: 'pr4', kind: 'income', title: '$750 speaking fee received', areaId: A.business, at: ago(11), ...s() },
      { id: 'pr5', kind: 'decision', title: 'Set FMH 101 launch price', areaId: A.dbm, projectId: 'p_fmh101', at: ago(4), ...s() },
    ],
    captures: [],
  }
}
