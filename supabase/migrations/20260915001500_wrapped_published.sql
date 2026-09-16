-- Distinguish a published Wrapped (season over, notified) from an on-demand preview.
alter table public.wrapped_snapshots add column published_at timestamptz;

create or replace function public.publish_wrapped_if_season_over(p_sport text, p_season integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_over boolean;
  u record;
  v_payload jsonb;
  v_count integer := 0;
begin
  select exists (select 1 from public.games where sport_id = p_sport and season = p_season and game_type = 'postseason' and status = 'final')
     and not exists (select 1 from public.games where sport_id = p_sport and season = p_season and status in ('scheduled', 'live'))
     and (select max(scheduled_start) from public.games where sport_id = p_sport and season = p_season and status = 'final') < now() - interval '2 days'
  into v_over;
  if not v_over then return 0; end if;
  for u in
    select distinct a.user_id from public.attendances a join public.games g on g.id = a.game_id
    where g.sport_id = p_sport and g.season = p_season and a.status = 'attended'
      and not exists (select 1 from public.wrapped_snapshots w where w.user_id = a.user_id and w.sport_id = p_sport and w.season = p_season and w.published_at is not null)
  loop
    v_payload := public.generate_wrapped(u.user_id, p_sport, p_season);
    if v_payload is null then continue; end if;
    insert into public.wrapped_snapshots (user_id, sport_id, season, payload, generated_at, published_at)
    values (u.user_id, p_sport, p_season, v_payload, now(), now())
    on conflict (user_id, sport_id, season) do update set payload = excluded.payload, generated_at = now(), published_at = now();
    insert into public.feed_events (actor_user_id, type, payload) values (u.user_id, 'wrapped_published', jsonb_build_object('sport_id', p_sport, 'season', p_season));
    insert into public.notifications (user_id, kind, title, body, data)
    values (u.user_id, 'wrapped_ready', 'Your ' || p_season || ' ' || upper(p_sport) || ' Wrapped is ready', 'See your season in numbers.', jsonb_build_object('sport_id', p_sport, 'season', p_season));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
