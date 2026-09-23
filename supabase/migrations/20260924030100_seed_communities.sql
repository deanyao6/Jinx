-- Social v2, prompt 4: seed the official communities (section 1). One per active team in all
-- four sports (00_repo_reality.md R3, not just MLB and NFL), one per distinct home venue of an
-- active team, and a starter school. User-created communities (`kind = 'custom'`) are out of
-- scope for this prompt; see docs/COMMUNITIES.md.

create or replace function public.slugify(p_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(p_text)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.seed_official_communities()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A nickname shared across sports (Cardinals, Giants) gets the sport folded into its slug so
  -- both keep separate communities; every other team's slug is just its nickname.
  insert into public.communities (slug, name, kind, team_id, is_official)
  select
    public.slugify(t.nickname) || case when dupe.nickname is null then '' else '-' || t.sport_id end || '-fans',
    t.nickname || ' Fans', 'team', t.id, true
  from public.teams t
  left join (
    select nickname from public.teams where active group by nickname having count(*) > 1
  ) dupe on dupe.nickname = t.nickname
  where t.active
  on conflict (slug) do update set name = excluded.name, team_id = excluded.team_id;

  insert into public.communities (slug, name, kind, venue_id, is_official)
  select public.slugify(v.name), v.name, 'venue', v.id, true
  from public.venues v
  where exists (select 1 from public.teams t where t.home_venue_id = v.id and t.active)
  on conflict (slug) do update set name = excluded.name, venue_id = excluded.venue_id;

  insert into public.communities (slug, name, kind, is_official)
  values ('caltech', 'Caltech', 'school', true)
  on conflict (slug) do update set name = excluded.name;
end;
$$;

select public.seed_official_communities();

revoke all on function public.seed_official_communities() from public, anon, authenticated;
