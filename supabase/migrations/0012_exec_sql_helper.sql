-- Lets the app apply future migrations programmatically (via the service-role key) instead of
-- pasting SQL into the dashboard editor by hand each time.
--
-- SECURITY: this runs arbitrary SQL with the privileges of its owner, which is real DDL/DML
-- power well beyond normal table CRUD — it must stay reachable only by the service-role key,
-- which already has full database access and is never exposed to the browser (see
-- src/shared/lib/supabase/server.ts). The anon key IS shipped to the browser (used for direct
-- storage uploads, src/shared/lib/supabase/client.ts), so anon/authenticated are explicitly
-- revoked below — without that, this function would be a public arbitrary-SQL endpoint.
create or replace function exec_sql(sql text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute sql;
end;
$$;

revoke all on function exec_sql(text) from public;
revoke all on function exec_sql(text) from anon;
revoke all on function exec_sql(text) from authenticated;
grant execute on function exec_sql(text) to service_role;
