-- A badge earned makes a system post (docs/prompts/social/04, section 5), the same way a stamp,
-- milestone, goal or Wrapped does (prompt 2's feed_events_to_posts). 'badge_earned' feed events
-- already exist (migration 20260924030000); this teaches the feed session's trigger about them,
-- since it is the one that owns posts.kind and the conversion.

alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check
  check (kind in ('game', 'reaction', 'stamp', 'milestone', 'goal', 'wrapped', 'badge'));

create or replace function public.feed_events_to_posts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case new.type
    when 'new_stamp' then 'stamp'
    when 'milestone' then 'milestone'
    when 'goal_completed' then 'goal'
    when 'wrapped_published' then 'wrapped'
    when 'badge_earned' then 'badge'
  end;
  v_profile public.profiles;
  v_start timestamptz;
begin
  if v_kind is null then return null; end if;
  select * into v_profile from public.profiles where id = new.actor_user_id;
  if v_profile.id is null or v_kind = any (v_profile.muted_post_kinds) then return null; end if;
  if v_kind in ('stamp', 'milestone') then
    select scheduled_start into v_start from public.games where id = new.game_id;
    if v_start is null or v_start < now() - interval '7 days' then return null; end if;
  end if;
  insert into public.posts (author_id, kind, game_id, visibility, created_at, published_at, payload)
  values (
    new.actor_user_id, v_kind, new.game_id,
    case when new.visibility = 'private' then 'private' else v_profile.post_visibility end,
    new.created_at, new.created_at, new.payload
  );
  return null;
end;
$$;
