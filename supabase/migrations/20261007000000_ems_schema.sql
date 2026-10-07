-- EMS schema. One table per collection. Each row stores the full record in
-- `data` (jsonb) plus indexed columns used for filtering. Row-level security
-- keeps every row private to the signed-in user.
--
-- Relationships between any two records live in ems_links
-- (from_type/from_id -> to_type/to_id), which powers the connected
-- "everything related to X" view.

create table if not exists public.ems_areas (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_areas_area_idx on public.ems_areas (user_id, area_id);
create index if not exists ems_areas_project_idx on public.ems_areas (user_id, project_id);
alter table public.ems_areas enable row level security;
drop policy if exists "ems_areas owner" on public.ems_areas;
create policy "ems_areas owner" on public.ems_areas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_learning_areas (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_learning_areas_area_idx on public.ems_learning_areas (user_id, area_id);
create index if not exists ems_learning_areas_project_idx on public.ems_learning_areas (user_id, project_id);
alter table public.ems_learning_areas enable row level security;
drop policy if exists "ems_learning_areas owner" on public.ems_learning_areas;
create policy "ems_learning_areas owner" on public.ems_learning_areas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_projects (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_projects_area_idx on public.ems_projects (user_id, area_id);
create index if not exists ems_projects_project_idx on public.ems_projects (user_id, project_id);
alter table public.ems_projects enable row level security;
drop policy if exists "ems_projects owner" on public.ems_projects;
create policy "ems_projects owner" on public.ems_projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_milestones (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_milestones_area_idx on public.ems_milestones (user_id, area_id);
create index if not exists ems_milestones_project_idx on public.ems_milestones (user_id, project_id);
alter table public.ems_milestones enable row level security;
drop policy if exists "ems_milestones owner" on public.ems_milestones;
create policy "ems_milestones owner" on public.ems_milestones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_tasks (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_tasks_area_idx on public.ems_tasks (user_id, area_id);
create index if not exists ems_tasks_project_idx on public.ems_tasks (user_id, project_id);
alter table public.ems_tasks enable row level security;
drop policy if exists "ems_tasks owner" on public.ems_tasks;
create policy "ems_tasks owner" on public.ems_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_ongoing_work (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_ongoing_work_area_idx on public.ems_ongoing_work (user_id, area_id);
create index if not exists ems_ongoing_work_project_idx on public.ems_ongoing_work (user_id, project_id);
alter table public.ems_ongoing_work enable row level security;
drop policy if exists "ems_ongoing_work owner" on public.ems_ongoing_work;
create policy "ems_ongoing_work owner" on public.ems_ongoing_work
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_goals (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_goals_area_idx on public.ems_goals (user_id, area_id);
create index if not exists ems_goals_project_idx on public.ems_goals (user_id, project_id);
alter table public.ems_goals enable row level security;
drop policy if exists "ems_goals owner" on public.ems_goals;
create policy "ems_goals owner" on public.ems_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_campaigns (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_campaigns_area_idx on public.ems_campaigns (user_id, area_id);
create index if not exists ems_campaigns_project_idx on public.ems_campaigns (user_id, project_id);
alter table public.ems_campaigns enable row level security;
drop policy if exists "ems_campaigns owner" on public.ems_campaigns;
create policy "ems_campaigns owner" on public.ems_campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_events (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_events_area_idx on public.ems_events (user_id, area_id);
create index if not exists ems_events_project_idx on public.ems_events (user_id, project_id);
alter table public.ems_events enable row level security;
drop policy if exists "ems_events owner" on public.ems_events;
create policy "ems_events owner" on public.ems_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_ideas (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_ideas_area_idx on public.ems_ideas (user_id, area_id);
create index if not exists ems_ideas_project_idx on public.ems_ideas (user_id, project_id);
alter table public.ems_ideas enable row level security;
drop policy if exists "ems_ideas owner" on public.ems_ideas;
create policy "ems_ideas owner" on public.ems_ideas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_income (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_income_area_idx on public.ems_income (user_id, area_id);
create index if not exists ems_income_project_idx on public.ems_income (user_id, project_id);
alter table public.ems_income enable row level security;
drop policy if exists "ems_income owner" on public.ems_income;
create policy "ems_income owner" on public.ems_income
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_offers (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_offers_area_idx on public.ems_offers (user_id, area_id);
create index if not exists ems_offers_project_idx on public.ems_offers (user_id, project_id);
alter table public.ems_offers enable row level security;
drop policy if exists "ems_offers owner" on public.ems_offers;
create policy "ems_offers owner" on public.ems_offers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_content (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_content_area_idx on public.ems_content (user_id, area_id);
create index if not exists ems_content_project_idx on public.ems_content (user_id, project_id);
alter table public.ems_content enable row level security;
drop policy if exists "ems_content owner" on public.ems_content;
create policy "ems_content owner" on public.ems_content
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_assets (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_assets_area_idx on public.ems_assets (user_id, area_id);
create index if not exists ems_assets_project_idx on public.ems_assets (user_id, project_id);
alter table public.ems_assets enable row level security;
drop policy if exists "ems_assets owner" on public.ems_assets;
create policy "ems_assets owner" on public.ems_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_contacts (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_contacts_area_idx on public.ems_contacts (user_id, area_id);
create index if not exists ems_contacts_project_idx on public.ems_contacts (user_id, project_id);
alter table public.ems_contacts enable row level security;
drop policy if exists "ems_contacts owner" on public.ems_contacts;
create policy "ems_contacts owner" on public.ems_contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_notes (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_notes_area_idx on public.ems_notes (user_id, area_id);
create index if not exists ems_notes_project_idx on public.ems_notes (user_id, project_id);
alter table public.ems_notes enable row level security;
drop policy if exists "ems_notes owner" on public.ems_notes;
create policy "ems_notes owner" on public.ems_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_links (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_links_area_idx on public.ems_links (user_id, area_id);
create index if not exists ems_links_project_idx on public.ems_links (user_id, project_id);
alter table public.ems_links enable row level security;
drop policy if exists "ems_links owner" on public.ems_links;
create policy "ems_links owner" on public.ems_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_wellness (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_wellness_area_idx on public.ems_wellness (user_id, area_id);
create index if not exists ems_wellness_project_idx on public.ems_wellness (user_id, project_id);
alter table public.ems_wellness enable row level security;
drop policy if exists "ems_wellness owner" on public.ems_wellness;
create policy "ems_wellness owner" on public.ems_wellness
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_agents (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_agents_area_idx on public.ems_agents (user_id, area_id);
create index if not exists ems_agents_project_idx on public.ems_agents (user_id, project_id);
alter table public.ems_agents enable row level security;
drop policy if exists "ems_agents owner" on public.ems_agents;
create policy "ems_agents owner" on public.ems_agents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_ai_actions (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_ai_actions_area_idx on public.ems_ai_actions (user_id, area_id);
create index if not exists ems_ai_actions_project_idx on public.ems_ai_actions (user_id, project_id);
alter table public.ems_ai_actions enable row level security;
drop policy if exists "ems_ai_actions owner" on public.ems_ai_actions;
create policy "ems_ai_actions owner" on public.ems_ai_actions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_notifications (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_notifications_area_idx on public.ems_notifications (user_id, area_id);
create index if not exists ems_notifications_project_idx on public.ems_notifications (user_id, project_id);
alter table public.ems_notifications enable row level security;
drop policy if exists "ems_notifications owner" on public.ems_notifications;
create policy "ems_notifications owner" on public.ems_notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_progress (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_progress_area_idx on public.ems_progress (user_id, area_id);
create index if not exists ems_progress_project_idx on public.ems_progress (user_id, project_id);
alter table public.ems_progress enable row level security;
drop policy if exists "ems_progress owner" on public.ems_progress;
create policy "ems_progress owner" on public.ems_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ems_captures (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_captures_area_idx on public.ems_captures (user_id, area_id);
create index if not exists ems_captures_project_idx on public.ems_captures (user_id, project_id);
alter table public.ems_captures enable row level security;
drop policy if exists "ems_captures owner" on public.ems_captures;
create policy "ems_captures owner" on public.ems_captures
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Relationship lookups in both directions.
create index if not exists ems_links_from_idx on public.ems_links (user_id, (data->>'fromId'));
create index if not exists ems_links_to_idx on public.ems_links (user_id, (data->>'toId'));
