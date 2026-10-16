-- Content Studio: campaigns, drafts, approvals, publishing records, metrics
-- and initiative brand settings.
--
-- Additive only: creates new tables, adds one nullable column, and adds a
-- guard trigger. No existing table, column or row is dropped or rewritten.
--
-- Campaigns and drafts reuse the existing ems_campaigns and ems_content
-- tables (records live in the jsonb `data` column), so nothing is duplicated.
-- Links between records (draft -> campaign, revision -> draft) are kept by
-- the app and indexed here. They are not foreign keys, because the app saves
-- each record in its own request and cannot guarantee the order.

-- 1. New tables, same shape and privacy rules as the existing ems_* tables.
create table if not exists public.ems_content_revisions (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  content_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_content_revisions_area_idx on public.ems_content_revisions (user_id, area_id);
create index if not exists ems_content_revisions_content_id_idx on public.ems_content_revisions (user_id, content_id);
alter table public.ems_content_revisions enable row level security;
drop policy if exists "ems_content_revisions owner" on public.ems_content_revisions;
create policy "ems_content_revisions owner" on public.ems_content_revisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.ems_content_revisions to authenticated;
revoke all on public.ems_content_revisions from anon;

create table if not exists public.ems_content_events (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  content_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_content_events_area_idx on public.ems_content_events (user_id, area_id);
create index if not exists ems_content_events_content_id_idx on public.ems_content_events (user_id, content_id);
alter table public.ems_content_events enable row level security;
drop policy if exists "ems_content_events owner" on public.ems_content_events;
create policy "ems_content_events owner" on public.ems_content_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.ems_content_events to authenticated;
revoke all on public.ems_content_events from anon;

create table if not exists public.ems_campaign_metrics (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  area_id text,
  project_id text,
  status text,
  campaign_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ems_campaign_metrics_area_idx on public.ems_campaign_metrics (user_id, area_id);
create index if not exists ems_campaign_metrics_campaign_id_idx on public.ems_campaign_metrics (user_id, campaign_id);
alter table public.ems_campaign_metrics enable row level security;
drop policy if exists "ems_campaign_metrics owner" on public.ems_campaign_metrics;
create policy "ems_campaign_metrics owner" on public.ems_campaign_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.ems_campaign_metrics to authenticated;
revoke all on public.ems_campaign_metrics from anon;

create table if not exists public.ems_brand_settings (
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
create index if not exists ems_brand_settings_area_idx on public.ems_brand_settings (user_id, area_id);
alter table public.ems_brand_settings enable row level security;
drop policy if exists "ems_brand_settings owner" on public.ems_brand_settings;
create policy "ems_brand_settings owner" on public.ems_brand_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.ems_brand_settings to authenticated;
revoke all on public.ems_brand_settings from anon;

-- 2. Index drafts by campaign.
alter table public.ems_content add column if not exists campaign_id text;
create index if not exists ems_content_campaign_id_idx on public.ems_content (user_id, campaign_id);

-- 3. Roles. owner and approver may approve; editor may write and submit;
--    viewer may read. A user with no row is an editor.
--    Rows are managed by the account owner in the Supabase SQL editor.
create table if not exists public.ems_user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'approver', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);
alter table public.ems_user_roles enable row level security;
drop policy if exists "ems_user_roles read own" on public.ems_user_roles;
create policy "ems_user_roles read own" on public.ems_user_roles
  for select using (auth.uid() = user_id);
grant select on public.ems_user_roles to authenticated;
revoke all on public.ems_user_roles from anon;

-- Everyone who already has an account when this runs is its owner.
insert into public.ems_user_roles (user_id, role)
select id, 'owner' from auth.users
on conflict (user_id) do nothing;

create or replace function public.ems_can_approve()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ems_user_roles
    where user_id = auth.uid() and role in ('owner', 'approver')
  );
$$;

-- 4. Guard: only owners and approvers can approve or request changes,
--    even if someone bypasses the app. Sample (demo) records and the SQL
--    editor (no signed-in user) are exempt.
create or replace function public.ems_guard_content_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_status text := new.data->>'status';
  old_status text;
begin
  if auth.uid() is null or coalesce((new.data->>'demo')::boolean, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    old_status := old.data->>'status';
  else
    -- An upsert arrives as an insert; compare with the stored row.
    select data->>'status' into old_status from public.ems_content
    where user_id = new.user_id and id = new.id;
  end if;
  if new_status in ('approved', 'scheduled', 'published')
     and (old_status is null or old_status not in ('approved', 'scheduled', 'published'))
     and not public.ems_can_approve() then
    raise exception 'Only an owner or approver can approve content.' using errcode = '42501';
  end if;
  if new_status = 'changes_requested' and old_status is distinct from 'changes_requested'
     and not public.ems_can_approve() then
    raise exception 'Only an owner or approver can request changes.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists ems_guard_content_approval on public.ems_content;
create trigger ems_guard_content_approval
  before insert or update on public.ems_content
  for each row execute function public.ems_guard_content_approval();

create or replace function public.ems_guard_approval_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.data->>'to' in ('approved', 'changes_requested')
     and not public.ems_can_approve() then
    raise exception 'Only an owner or approver can record an approval.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists ems_guard_approval_events on public.ems_content_events;
create trigger ems_guard_approval_events
  before insert or update on public.ems_content_events
  for each row execute function public.ems_guard_approval_events();
