-- Newer Supabase projects do not automatically let the API roles use new
-- tables. Give signed-in users access to the EMS tables. Row-level security
-- (from the first migration) still limits each user to their own rows.
-- The anonymous role gets nothing: EMS requires sign-in.
grant usage on schema public to authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'ems\_%' loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
