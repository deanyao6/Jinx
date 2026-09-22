-- Venues have no sport column: derive league membership from games and home teams.
create or replace function public.search_entities_v2(p_phrases text[], p_sport text default null)
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
        where (p_sport is null or exists(select 1 from public.games vg where vg.venue_id=v.id and vg.sport_id=p_sport) or exists(select 1 from public.teams vt where vt.home_venue_id=v.id and vt.sport_id=p_sport)) and (
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
