-- The secret handshake (an easter egg; Dean, 2026-09-17). Two people who follow each other and
-- are both checked in to the same game each tap the other's avatar. When both have, within the
-- game's check-in window (SPEC.md 6.3), both get a shared "We were there" card.
--
-- A row is ONE side's offer: `from_user` tapped `to_user`. The handshake is complete when the
-- reverse row exists. One per pair per game, which the primary key is.
--
-- The secret is the point. An offer must be invisible to its target until they offer back, so:
--   * clients never insert here. `offer_handshake` is the only way in, and it checks everything;
--   * the select policy shows a user only the rows THEY offered (`from_user`), never the ones
--     aimed at them;
--   * `my_handshakes` answers from the caller's own offers outward, so an incoming one-sided
--     offer has no row to start from and cannot appear.

create table public.handshakes (
  game_id uuid not null references public.games (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, from_user, to_user),
  check (from_user <> to_user)
);
-- The reverse lookup ("has the other side offered?") is by (game_id, from_user = them, to_user = me),
-- which the primary key already serves. This one serves the cascade from profiles on `to_user`.
create index handshakes_to_user_idx on public.handshakes (to_user);

alter table public.handshakes enable row level security;

-- Only what you offered. No insert, update or delete policy: the RPC below is the only writer,
-- and a handshake, once offered, is not taken back.
create policy handshakes_select_own_offers on public.handshakes
  for select to authenticated
  using (from_user = auth.uid());

revoke all on table public.handshakes from public, anon, authenticated;
grant select on table public.handshakes to authenticated;

-- ---------------------------------------------------------------------------
-- Offer a handshake. Returns { offered: true, complete: <the other side has offered too> },
-- or { offered: false, reason } when refused.
--
-- A block answers 'not_mutual', the same as not following each other: saying "blocked" would
-- tell the caller they have been blocked, which nothing else in the app reveals (SPEC.md 9).
-- ---------------------------------------------------------------------------
create or replace function public.offer_handshake(p_game_id uuid, p_to_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g record;
  v_now timestamptz := now();
  v_complete boolean;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  if p_game_id is null or p_to_user is null then
    raise exception 'game and user are required' using errcode = 'check_violation';
  end if;
  if p_to_user = v_uid then
    return jsonb_build_object('offered', false, 'reason', 'self');
  end if;

  select gm.scheduled_start, gm.final_at into g from public.games gm where gm.id = p_game_id;
  if not found then raise exception 'unknown game' using errcode = 'no_data_found'; end if;

  -- Blocks first, and explicitly, even though is_mutual also refuses a blocked pair: this is
  -- the check that must never be lost if the follow rule is ever loosened.
  if public.is_blocked_between(v_uid, p_to_user) or not public.is_mutual(v_uid, p_to_user) then
    return jsonb_build_object('offered', false, 'reason', 'not_mutual');
  end if;

  if not exists (select 1 from public.checkins c where c.user_id = v_uid and c.game_id = p_game_id) then
    return jsonb_build_object('offered', false, 'reason', 'not_checked_in');
  end if;
  if not exists (select 1 from public.checkins c where c.user_id = p_to_user and c.game_id = p_game_id) then
    return jsonb_build_object('offered', false, 'reason', 'they_are_not_checked_in');
  end if;

  -- An offer already made stands, whenever it is asked about again. A NEW one needs the
  -- check-in window (the same one `check_in` enforces) to be open.
  if not exists (select 1 from public.handshakes h where h.game_id = p_game_id and h.from_user = v_uid and h.to_user = p_to_user) then
    if v_now < g.scheduled_start - interval '3 hours'
       or v_now > coalesce(g.final_at + interval '1 hour', g.scheduled_start + interval '6 hours') then
      return jsonb_build_object('offered', false, 'reason', 'outside_window');
    end if;
    insert into public.handshakes (game_id, from_user, to_user)
    values (p_game_id, v_uid, p_to_user)
    on conflict do nothing;
  end if;

  v_complete := exists (
    select 1 from public.handshakes h
    where h.game_id = p_game_id and h.from_user = p_to_user and h.to_user = v_uid
  );
  return jsonb_build_object('offered', true, 'complete', v_complete);
end;
$$;

-- ---------------------------------------------------------------------------
-- The caller's handshakes at one game: everyone they have offered to, and whether it is
-- 'complete' (the other side offered too) or still 'waiting'.
--
-- It starts from the caller's OWN offers, so somebody else's one-sided offer to the caller is
-- not in the result in any form. A pair that has since blocked each other drops out.
-- ---------------------------------------------------------------------------
create or replace function public.my_handshakes(p_game_id uuid)
returns table (
  user_id uuid, handle text, display_name text, avatar_path text,
  state text, offered_at timestamptz, completed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.handle, pr.display_name, pr.avatar_path,
         case when back.from_user is null then 'waiting' else 'complete' end,
         mine.created_at,
         case when back.from_user is null then null else greatest(mine.created_at, back.created_at) end
  from public.handshakes mine
  join public.profiles pr on pr.id = mine.to_user
  left join public.handshakes back
    on back.game_id = mine.game_id and back.from_user = mine.to_user and back.to_user = mine.from_user
  where auth.uid() is not null
    and mine.game_id = p_game_id
    and mine.from_user = auth.uid()
    and not public.is_blocked_between(auth.uid(), mine.to_user)
  order by mine.created_at;
$$;

-- ---------------------------------------------------------------------------
-- Who the caller could shake hands with at one game: mutual follows (never a blocked pair)
-- who have a check-in there. Empty unless the caller is checked in too, so it says nothing to
-- somebody who is not at the game. It says nothing about offers in either direction.
--
-- `checkins` is owner-only under RLS, which is why this is a function. A mutual's verified
-- attendance at the game is already visible to the caller, so "they checked in" is not news.
-- ---------------------------------------------------------------------------
create or replace function public.handshake_candidates(p_game_id uuid)
returns table (user_id uuid, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.avatar_path
  from public.checkins c
  join public.profiles pr on pr.id = c.user_id
  where auth.uid() is not null
    and c.game_id = p_game_id
    and c.user_id <> auth.uid()
    and exists (select 1 from public.checkins me where me.user_id = auth.uid() and me.game_id = p_game_id)
    and not public.is_blocked_between(auth.uid(), c.user_id)
    and public.is_mutual(auth.uid(), c.user_id);
$$;

revoke all on function public.offer_handshake(uuid, uuid) from public, anon;
revoke all on function public.my_handshakes(uuid) from public, anon;
grant execute on function public.offer_handshake(uuid, uuid) to authenticated;
grant execute on function public.my_handshakes(uuid) to authenticated;
revoke all on function public.handshake_candidates(uuid) from public, anon;
grant execute on function public.handshake_candidates(uuid) to authenticated;
