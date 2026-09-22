-- Additive search API. Existing mobile builds keep using the v1 functions unchanged.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.search_normalize_v2(value text)
returns text language sql stable set search_path = public, extensions as $$
  select trim(regexp_replace(lower(extensions.unaccent(coalesce(value,''))), '[^a-z0-9]+', ' ', 'g'));
$$;

alter table public.team_aliases add column search_name text not null default '';
alter table public.venue_aliases add column search_name text not null default '';
create function public.search_alias_sync_v2() returns trigger
language plpgsql set search_path = public as $$
begin
  new.search_name := public.search_normalize_v2(new.alias);
  return new;
end;
$$;
create trigger team_alias_search_v2 before insert or update on public.team_aliases
for each row execute function public.search_alias_sync_v2();
create trigger venue_alias_search_v2 before insert or update on public.venue_aliases
for each row execute function public.search_alias_sync_v2();
update public.team_aliases set search_name = public.search_normalize_v2(alias);
update public.venue_aliases set search_name = public.search_normalize_v2(alias);
create index team_alias_search_prefix_v2 on public.team_aliases(search_name text_pattern_ops);
create index venue_alias_search_prefix_v2 on public.venue_aliases(search_name text_pattern_ops);
create index team_alias_search_trgm_v2 on public.team_aliases using gin(search_name extensions.gin_trgm_ops);
create index venue_alias_search_trgm_v2 on public.venue_aliases using gin(search_name extensions.gin_trgm_ops);

create function public.search_entities_v2(p_phrases text[], p_sport text default null)
returns jsonb language plpgsql stable security invoker set search_path = public, extensions as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to search' using errcode='42501'; end if;
  if cardinality(p_phrases) > 60 or exists(select 1 from unnest(p_phrases) p where length(p)>160)
    then raise exception 'Search is too long' using errcode='22023'; end if;
  if p_sport is not null and p_sport not in ('mlb','nfl','nba','mls')
    then raise exception 'Invalid league' using errcode='22023'; end if;
  with phrases as materialized (
    select distinct public.search_normalize_v2(p) as phrase from unnest(p_phrases) p where length(trim(p))>=2
  ), hits as (
    select p.phrase, c.* from phrases p cross join lateral (
      select distinct on (kind,id) * from (
        select t.id, 'team'::text kind,t.name,t.name || ' · ' || upper(t.sport_id) as label, a.alias,
          case when a.search_name=p.phrase then 0 when a.search_name like p.phrase || '%' then 1 else 2 end tier,
          round(extensions.similarity(a.search_name,p.phrase)*1000)::int quality
        from public.team_aliases a join public.teams t on t.id=a.team_id
        where (p_sport is null or t.sport_id=p_sport) and (
          a.search_name=p.phrase or a.search_name like p.phrase || '%' or
          (length(p.phrase)>=4 and p.phrase !~ '^\d+$' and a.search_name operator(extensions.%) p.phrase
           and extensions.similarity(a.search_name,p.phrase)>=0.42))
        union all
        select v.id,'venue',v.name,v.name || coalesce(' · ' || v.city,''),a.alias,
          case when a.search_name=p.phrase then 0 when a.search_name like p.phrase || '%' then 1 else 2 end,
          round(extensions.similarity(a.search_name,p.phrase)*1000)::int
        from public.venue_aliases a join public.venues v on v.id=a.venue_id
        where (p_sport is null or p_sport=any(v.sports)) and (
          a.search_name=p.phrase or a.search_name like p.phrase || '%' or
          (length(p.phrase)>=4 and p.phrase !~ '^\d+$' and a.search_name operator(extensions.%) p.phrase
           and extensions.similarity(a.search_name,p.phrase)>=0.42))
      ) aliases order by kind,id,tier,quality desc,length(alias),alias
    ) c
  ), ranked as (
    select *,row_number() over(partition by phrase order by tier,quality desc,kind,name,id) as rn from hits
  ) select coalesce(jsonb_agg(to_jsonb(r)-'rn' order by phrase,tier,quality desc,name,id),'[]'::jsonb)
    into result from ranked r where rn<=8;
  return result;
end;
$$;
revoke all on function public.search_entities_v2(text[],text) from public,anon;
grant execute on function public.search_entities_v2(text[],text) to authenticated;

-- Entity resolution is shared TypeScript, tested independently; SQL enforces constraints,
-- owner visibility, bounded pages and cursor identity even for direct API callers.
create function public.search_games_v2(
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
  ascending_sort boolean := p_sort='oldest' or p_filters->>'time'='upcoming';
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
