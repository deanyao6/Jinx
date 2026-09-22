-- Include curated nicknames/abbreviations in alias lookup, where supplied by the catalog.
insert into public.team_aliases(team_id,alias)
select id,nickname from public.teams where nullif(trim(nickname),'') is not null
on conflict do nothing;
insert into public.team_aliases(team_id,alias)
select id,abbreviation from public.teams where nullif(trim(abbreviation),'') is not null
on conflict do nothing;

-- Optional time filters must not make the sort direction NULL.
create or replace function public.search_games_v2(
  p_filters jsonb default '{}', p_selection jsonb default '{}', p_query text default '',
  p_scope text default 'all', p_sort text default 'best', p_cursor jsonb default null,
  p_limit integer default 25, p_personal_text boolean default false
) returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  owner_id uuid := auth.uid();
  sport text := nullif(p_filters->>'sport','');
  season_no integer := (p_filters->>'season')::integer;
  from_date date := (nullif(p_filters->>'from',''))::date;
  to_date date := (nullif(p_filters->>'to',''))::date;
  filter_team uuid := (p_filters->>'teamId')::uuid;
  filter_venue uuid := (p_filters->>'venueId')::uuid;
  venue uuid := (p_selection->>'venueId')::uuid;
  home_id uuid := (p_selection->>'homeId')::uuid;
  away_id uuid := (p_selection->>'awayId')::uuid;
  team_ids uuid[];
  query_text text := public.search_normalize_v2(p_query);
  fingerprint text;
  anchor timestamptz := coalesce((p_cursor->>'anchor')::timestamptz,now());
  cursor_time timestamptz := (p_cursor->>'time')::timestamptz;
  cursor_id uuid := (p_cursor->>'id')::uuid;
  ascending_sort boolean := p_sort='oldest' or coalesce(p_filters->>'time'='upcoming',false);
  page_size integer := coalesce(p_limit,25);
  rows_json jsonb;
  last_row jsonb;
  next_cursor jsonb;
begin
  if owner_id is null then raise exception 'Sign in to search' using errcode='42501'; end if;
  if p_scope not in ('all','mine') or p_sort not in ('best','newest','oldest')
    or page_size not between 1 and 50 or length(p_query)>160
    or (p_personal_text and p_scope<>'mine') or jsonb_typeof(p_filters)<>'object'
    or jsonb_typeof(p_selection)<>'object'
    or (sport is not null and sport not in ('mlb','nfl','nba','mls'))
    or (p_filters ? 'time' and p_filters->>'time' not in ('past','upcoming'))
    or from_date>to_date then raise exception 'Invalid search filters' using errcode='22023'; end if;
  select coalesce(array_agg(value::uuid),'{}') into team_ids
    from jsonb_array_elements_text(coalesce(p_selection->'teamIds','[]'));
  if cardinality(team_ids)>2 or cardinality(team_ids)<>(select count(distinct x) from unnest(team_ids) x)
    or (home_id is not null and (away_id is null or home_id=away_id))
    or (away_id is not null and home_id is null)
    then raise exception 'Choose two distinct teams for a matchup' using errcode='22023'; end if;
  fingerprint := md5(jsonb_build_array(2,owner_id,p_filters,p_selection,p_query,p_scope,p_sort,p_personal_text)::text);
  if p_cursor is not null and (p_cursor->>'key' is distinct from fingerprint or cursor_time is null or cursor_id is null
      or not(p_cursor ? 'anchor')) then raise exception 'Search changed; restart pagination' using errcode='22023'; end if;

  with own_games as materialized (
    select a.game_id, a.id as attendance_id from public.attendances a
    where a.user_id=owner_id and a.status='attended'
  ), found as (
    select g.id,g.sport_id,g.season,g.season_label,g.game_type,g.scheduled_start,g.status,
      g.home_team_id,ht.name as home_team_name,ht.abbreviation as home_abbr,
      g.away_team_id,at.name as away_team_name,at.abbreviation as away_abbr,
      g.home_score,g.away_score,g.is_tie,g.doubleheader_number,g.winner_team_id,
      g.decision_method,g.home_shootout_score,g.away_shootout_score,
      g.venue_id,v.name as venue_name,v.city as venue_city,
      public.game_local_date(g.scheduled_start,v.tz) as local_date,
      exists(select 1 from own_games o where o.game_id=g.id) as logged
    from public.games g
    join public.teams ht on ht.id=g.home_team_id
    join public.teams at on at.id=g.away_team_id
    left join public.venues v on v.id=g.venue_id
    where (p_scope='all' or exists(select 1 from own_games o where o.game_id=g.id))
      and (sport is null or g.sport_id=sport) and (season_no is null or g.season=season_no)
      and (from_date is null or (g.scheduled_start>=(from_date-1)::timestamptz
        and public.game_local_date(g.scheduled_start,v.tz)>=from_date))
      and (to_date is null or (g.scheduled_start<(to_date+2)::timestamptz
        and public.game_local_date(g.scheduled_start,v.tz)<=to_date))
      and (p_filters->>'time' is null or (p_filters->>'time'='past' and g.scheduled_start<=anchor)
        or (p_filters->>'time'='upcoming' and g.scheduled_start>anchor))
      and (filter_team is null or filter_team in (g.home_team_id,g.away_team_id))
      and (filter_venue is null or g.venue_id=filter_venue)
      and (venue is null or g.venue_id=venue)
      and (home_id is null or g.home_team_id=home_id)
      and (away_id is null or g.away_team_id=away_id)
      and (cardinality(team_ids)=0 or (
        (g.home_team_id=any(team_ids) or g.away_team_id=any(team_ids))
        and (cardinality(team_ids)=1 or (g.home_team_id=any(team_ids) and g.away_team_id=any(team_ids)))))
      and (not p_personal_text or position(query_text in public.search_normalize_v2(
        ht.name || ' ' || ht.abbreviation || ' ' || at.name || ' ' || at.abbreviation || ' ' ||
        coalesce(v.name,'') || ' ' || coalesce(g.home_score::text,'') || ' ' || coalesce(g.away_score::text,'') || ' ' ||
        coalesce(g.away_score::text,'') || ' ' || coalesce(g.home_score::text,'') || ' ' ||
        to_char(public.game_local_date(g.scheduled_start,v.tz),'Mon DD YYYY') || ' ' ||
        coalesce((select string_agg(p.display_name,' ') from own_games o
          join public.attendance_companions ac on ac.attendance_id=o.attendance_id
          join public.people p on p.id=ac.person_id and p.owner_user_id=owner_id where o.game_id=g.id),'')
      ))>0)
      and (p_cursor is null or (ascending_sort and (g.scheduled_start,g.id)>(cursor_time,cursor_id))
        or (not ascending_sort and (g.scheduled_start,g.id)<(cursor_time,cursor_id)))
    order by case when ascending_sort then g.scheduled_start end asc,
      case when not ascending_sort then g.scheduled_start end desc,
      case when ascending_sort then g.id end asc, case when not ascending_sort then g.id end desc
    limit page_size+1
  ) select coalesce(jsonb_agg(to_jsonb(f)),'[]') into rows_json from found f;
  if jsonb_array_length(rows_json)>page_size then
    rows_json := rows_json - page_size;
    last_row := rows_json->(page_size-1);
    next_cursor := jsonb_build_object('key',fingerprint,'anchor',anchor,'time',last_row->>'scheduled_start','id',last_row->>'id');
  end if;
  return jsonb_build_object('rows',rows_json,'nextCursor',next_cursor);
end;
$$;
revoke all on function public.search_games_v2(jsonb,jsonb,text,text,text,jsonb,integer,boolean) from public,anon;
grant execute on function public.search_games_v2(jsonb,jsonb,text,text,text,jsonb,integer,boolean) to authenticated;
