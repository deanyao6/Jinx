-- Scheduled jobs (SPEC.md 4.5). pg_cron calls Edge Functions through pg_net using secrets in Vault.
-- After deploying, store two secrets once:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.call_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise notice 'call_edge_function(%): vault secrets project_url / service_role_key not set', p_name;
    return null;
  end if;
  return net.http_post(
    url := v_url || '/functions/v1/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := p_body,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.call_edge_function(text, jsonb) from public, anon, authenticated;

-- MLB schedule + finals every 15 minutes. The function itself is cheap when nothing changed.
select cron.schedule('mlb-sync', '*/15 * * * *', $$select public.call_edge_function('mlb-sync')$$);

-- Keep the free-tier project from pausing and prune old notifications.
select cron.schedule('housekeeping-daily', '15 4 * * *', $$delete from public.notifications where created_at < now() - interval '90 days'$$);
