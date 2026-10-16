-- Checks the Content Studio approval guard and row-level security.
-- Run after supabase_stub.sql and all migrations on a scratch database:
--   psql -d scratch -f supabase/tests/supabase_stub.sql
--   for f in supabase/migrations/*.sql; do psql -d scratch -f "$f"; done
--   psql -d scratch -f supabase/tests/content_studio_rules.sql
-- Lines marked EXPECT ERROR must fail; everything else must succeed.
\set ON_ERROR_STOP 0
insert into auth.users values ('22222222-2222-2222-2222-222222222222');  -- joins after migration: no role row = editor
select 'roles:', user_id, role from public.ems_user_roles;
set role authenticated;
-- Editor (user 2)
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
insert into ems_content (id, data, status) values ('d1', '{"id":"d1","status":"draft"}', 'draft');
insert into ems_content (id, data, status) values ('d1', '{"id":"d1","status":"needs_review"}', 'needs_review')
  on conflict (user_id,id) do update set data = excluded.data;
select 'editor submit ->', data->>'status' from ems_content where id='d1';
\echo EXPECT ERROR (editor approves via upsert):
insert into ems_content (id, data) values ('d1', '{"id":"d1","status":"approved"}') on conflict (user_id,id) do update set data = excluded.data;
\echo EXPECT ERROR (editor approves via update):
update ems_content set data = '{"id":"d1","status":"approved"}' where id='d1';
\echo EXPECT ERROR (editor requests changes):
update ems_content set data = '{"id":"d1","status":"changes_requested"}' where id='d1';
\echo EXPECT ERROR (editor forges approval event):
insert into ems_content_events (id, data) values ('e1', '{"to":"approved"}');
insert into ems_content (id, data) values ('demo1', '{"id":"demo1","status":"published","demo":true}');
select 'editor sample row ok ->', count(*) from ems_content where id='demo1';
select 'editor sees own rows only ->', count(*) from ems_content;
-- Owner (user 1)
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select 'owner sees ->', count(*) from ems_content;
insert into ems_content (id, data) values ('o1', '{"id":"o1","status":"needs_review"}');
insert into ems_content (id, data) values ('o1', '{"id":"o1","status":"approved"}') on conflict (user_id,id) do update set data = excluded.data;
insert into ems_content (id, data) values ('o1', '{"id":"o1","status":"scheduled"}') on conflict (user_id,id) do update set data = excluded.data;
insert into ems_content_events (id, data, content_id) values ('e2', '{"to":"approved"}', 'o1');
select 'owner flow ->', data->>'status' from ems_content where id='o1';
select 'own role ->', role from ems_user_roles;
\echo EXPECT ERROR (user edits roles):
update ems_user_roles set role='owner';
insert into ems_user_roles values ('22222222-2222-2222-2222-222222222222','owner');
reset role;
set role anon;
\echo EXPECT ERROR (anonymous reads):
select count(*) from ems_content;
select count(*) from ems_campaign_metrics;
