-- Social v2, prompt 2, section 7: tagging a real user asks them first
-- (docs/prompts/social/02; 00_repo_reality.md, ruling R5).
--
-- Two paths, and only one of them changes:
--   - A placeholder ("Dad", no linked account) is a private label on your own attendance. It is
--     confirmed the moment it is made, notifies nobody, and has no pending state. Unchanged.
--   - A person linked to a real account starts pending (20260924000600). They get "Dean says
--     you were at Mets at Phillies, Sep 20. Add it?" and answer:
--       accept:  the tag is confirmed and the game is logged for them (manual, unverified); if
--                their auto-post is on, a draft goes up 15 minutes later like any other.
--       decline: the tag is removed. The tagger is told nothing, and a new tag of the same
--                person at the same game by the same tagger is dropped silently, forever.
--   Tags from someone blocked either way are dropped at creation, silently.
--   A pending tag is invisible to the tagged user everywhere but the question itself: not on
--   their game pages, not in their "tagged games", not in rivalries.

create table public.companion_declines (
  tagger_id uuid not null references public.profiles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  declined_at timestamptz not null default now(),
  primary key (tagger_id, user_id, game_id)
);
alter table public.companion_declines enable row level security;
-- The one who declined may see their own declines; the tagger may not.
create policy companion_declines_own on public.companion_declines for select to authenticated
  using (user_id = auth.uid());

-- Redefined from 20260924000600: the same status rule, plus the two silent drops. Returning
-- null from a before-insert trigger skips the row without an error, so the tagger's app sees
-- an ordinary insert.
create or replace function public.companions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linked uuid;
  v_game uuid;
begin
  select linked_user_id into v_linked from public.people where id = new.person_id;
  select user_id, game_id into new.invited_by, v_game from public.attendances where id = new.attendance_id;
  if v_linked is null or v_linked = new.invited_by then
    new.status := 'confirmed';
    new.confirmed_at := now();
    return new;
  end if;
  if public.is_blocked_between(new.invited_by, v_linked) then
    return null;
  end if;
  if exists (select 1 from public.companion_declines d
             where d.tagger_id = new.invited_by and d.user_id = v_linked and d.game_id = v_game) then
    return null;
  end if;
  -- Whatever the insert says. (This function is security definer, so it cannot tell a client
  -- from the server; it does not need to.)
  new.status := 'pending';
  new.confirmed_at := null;
  return new;
end;
$$;

-- The question, asked once, only of a real user, only while it is pending.
create or replace function public.companions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'pending' then return null; end if;
  insert into public.notifications (user_id, kind, title, body, data)
  select p.linked_user_id, 'tagged', 'Were you there?',
         coalesce(nullif(o.display_name, ''), o.handle) || ' says you were at '
           || coalesce(awt.nickname, awt.name) || ' at ' || coalesce(ht.nickname, ht.name) || ', '
           || to_char(g.scheduled_start at time zone coalesce(v.tz, 'America/New_York'), 'Mon FMDD') || '. Add it?',
         jsonb_build_object('user_id', o.id, 'game_id', a.game_id, 'attendance_id', new.attendance_id,
                            'person_id', new.person_id, 'pending', true)
  from public.people p
  join public.attendances a on a.id = new.attendance_id
  join public.profiles o on o.id = a.user_id
  join public.games g on g.id = a.game_id
  join public.teams ht on ht.id = g.home_team_id
  join public.teams awt on awt.id = g.away_team_id
  left join public.venues v on v.id = g.venue_id
  where p.id = new.person_id and p.linked_user_id is not null;
  return null;
end;
$$;

-- Importing a friend's tagged games (import_tagged_games) tags the owner back. The owner is a
-- real user, so that tag asks them too; they already logged the game, so accepting only
-- confirms the tag.

-- ---------------------------------------------------------------------------
-- Answering
-- ---------------------------------------------------------------------------

-- The tags waiting for me, newest first.
create or replace function public.my_pending_tags()
returns table (
  attendance_id uuid,
  person_id uuid,
  tagger_id uuid,
  tagger_handle text,
  tagger_display_name text,
  tagger_avatar_path text,
  game_id uuid,
  scheduled_start timestamptz,
  home_name text,
  away_name text,
  venue_name text,
  already_logged boolean,
  tagged_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ac.attendance_id, ac.person_id, a.user_id, o.handle, o.display_name, o.avatar_path,
         g.id, g.scheduled_start, coalesce(ht.nickname, ht.name), coalesce(awt.nickname, awt.name), v.name,
         exists (select 1 from public.attendances m where m.user_id = auth.uid() and m.game_id = g.id),
         a.created_at
  from public.attendance_companions ac
  join public.people p on p.id = ac.person_id and p.linked_user_id = auth.uid()
  join public.attendances a on a.id = ac.attendance_id
  join public.profiles o on o.id = a.user_id
  join public.games g on g.id = a.game_id
  join public.teams ht on ht.id = g.home_team_id
  join public.teams awt on awt.id = g.away_team_id
  left join public.venues v on v.id = g.venue_id
  where ac.status = 'pending' and not public.is_blocked_between(auth.uid(), a.user_id)
  order by a.created_at desc;
$$;

revoke all on function public.my_pending_tags() from public, anon;
grant execute on function public.my_pending_tags() to authenticated;

create or replace function public.answer_companion_tag(p_attendance_id uuid, p_person_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_tag record;
  v_attendance uuid;
  v_profile public.profiles;
begin
  if v_me is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  select ac.*, a.user_id as tagger_id, a.game_id into v_tag
  from public.attendance_companions ac
  join public.people p on p.id = ac.person_id and p.linked_user_id = v_me
  join public.attendances a on a.id = ac.attendance_id
  where ac.attendance_id = p_attendance_id and ac.person_id = p_person_id;
  if v_tag.attendance_id is null then
    raise exception 'no such tag' using errcode = 'no_data_found';
  end if;
  if v_tag.status <> 'pending' then return v_tag.status; end if;

  update public.notifications set read_at = coalesce(read_at, now())
  where user_id = v_me and kind = 'tagged'
    and data ->> 'attendance_id' = p_attendance_id::text and data ->> 'person_id' = p_person_id::text;

  if not p_accept then
    insert into public.companion_declines (tagger_id, user_id, game_id)
    values (v_tag.tagger_id, v_me, v_tag.game_id) on conflict do nothing;
    delete from public.attendance_companions where attendance_id = p_attendance_id and person_id = p_person_id;
    return 'declined';
  end if;

  update public.attendance_companions set status = 'confirmed'
  where attendance_id = p_attendance_id and person_id = p_person_id;

  insert into public.attendances (user_id, game_id, source, status, verified)
  values (v_me, v_tag.game_id, 'manual', 'attended', false)
  on conflict (user_id, game_id) do nothing
  returning id into v_attendance;

  -- A new log from an accepted tag posts like any other log with auto-post on, however long
  -- ago the game was: the fan just said yes to it.
  select * into v_profile from public.profiles where id = v_me;
  if v_attendance is not null and v_profile.auto_post
     and not exists (select 1 from public.auto_post_runs r where r.user_id = v_me and r.game_id = v_tag.game_id)
     and exists (select 1 from public.games g where g.id = v_tag.game_id and g.status = 'final') then
    insert into public.auto_post_runs (user_id, game_id, attendance_id) values (v_me, v_tag.game_id, v_attendance);
    with draft as (
      insert into public.posts (author_id, kind, attendance_id, visibility, auto_posted, publish_at, published_at)
      values (v_me, 'game', v_attendance, v_profile.post_visibility, true, now() + interval '15 minutes', null)
      returning id
    )
    update public.auto_post_runs set post_id = (select id from draft) where user_id = v_me and game_id = v_tag.game_id;
  end if;
  return 'confirmed';
end;
$$;

revoke all on function public.answer_companion_tag(uuid, uuid, boolean) from public, anon;
grant execute on function public.answer_companion_tag(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Pending tags stay out of the tagged user's views.
-- ---------------------------------------------------------------------------

create or replace function public.my_tags_at_game(p_game_id uuid)
returns table (attendance_id uuid, person_id uuid, owner_user_id uuid, owner_handle text, owner_display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, p.id, a.user_id, pr.handle, pr.display_name
  from public.attendance_companions ac
  join public.people p on p.id = ac.person_id and p.linked_user_id = auth.uid()
  join public.attendances a on a.id = ac.attendance_id and a.game_id = p_game_id and a.user_id <> auth.uid()
  join public.profiles pr on pr.id = a.user_id
  where ac.status = 'confirmed';
$$;

create or replace function public.tagged_games_for_me(p_owner uuid)
returns table (game_id uuid, attendance_id uuid, scheduled_start timestamptz, home_team_name text, away_team_name text, venue_name text, already_logged boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, a.id, g.scheduled_start, ht.name, at.name, v.name,
         exists (select 1 from public.attendances mine where mine.user_id = auth.uid() and mine.game_id = g.id)
  from public.attendance_companions ac
  join public.people p on p.id = ac.person_id and p.owner_user_id = p_owner and p.linked_user_id = auth.uid()
  join public.attendances a on a.id = ac.attendance_id and a.status = 'attended'
  join public.games g on g.id = a.game_id
  join public.teams ht on ht.id = g.home_team_id
  join public.teams at on at.id = g.away_team_id
  left join public.venues v on v.id = g.venue_id
  where auth.uid() is not null and not public.is_blocked_between(auth.uid(), p_owner)
    and ac.status = 'confirmed'
  order by g.scheduled_start desc;
$$;

-- Rivalries: "together" means a confirmed tag, both ways.
do $$
declare
  v_def text;
  v_a text := 'where ac.attendance_id = mi.attendance_id and p.linked_user_id = m.rival';
  v_b text := 'where ac.attendance_id = th.attendance_id and p.linked_user_id = v_uid';
begin
  select pg_get_functiondef('public.rivalries'::regproc) into v_def;
  if position(v_a in v_def) = 0 or position(v_b in v_def) = 0 then
    raise exception 'rivalries(): the companion clauses this migration expects are missing';
  end if;
  v_def := replace(v_def, v_a, v_a || ' and ac.status = ''confirmed''');
  v_def := replace(v_def, v_b, v_b || ' and ac.status = ''confirmed''');
  execute v_def;
end;
$$;

-- Third parties (followers looking at the tagger's game) see confirmed tags only. The tagger
-- sees every tag on their own attendance, and the tagged user sees theirs in any state, since
-- they must be able to answer or remove it; the views above keep pending ones out of
-- everything else they see.
drop policy attendance_companions_select on public.attendance_companions;
create policy attendance_companions_select on public.attendance_companions for select to authenticated
  using (
    exists (select 1 from public.attendances a where a.id = attendance_id and a.user_id = auth.uid())
    or exists (select 1 from public.people p where p.id = attendance_companions.person_id and p.linked_user_id = auth.uid())
    or (status = 'confirmed' and public.attendance_visible(attendance_id))
  );
