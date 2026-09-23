-- Social v2, prompt 3 (docs/prompts/social/03_reactions.md, sections 2, 3c, 4, 5 and 7): the
-- prompt engine, deliveries, copy templates, the photo bucket and the reads.
--
-- The rules are written once in packages/core/src/reactions (pure, tested) and enforced here,
-- where every phone and the mlb-live function meet:
--   three prompts a game at most, one scheduled plus up to two events; the scheduled slot is
--   held back; twelve minutes between prompts for a person; an event inside the late window
--   before the scheduled prompt fired merges into it; two ignored prompts in a row silence the
--   rest of the game; nothing in the first ten minutes or after a session ends; event prompts
--   go to the side they benefit; self-triggered reactions do not count, five at most; three of
--   them at one game within 90 seconds is a crowd moment, once a game, on an event slot.
--
-- Who fires: `mlb-live` (the server reads MLB) and, for the NBA, MLS and NFL, whose feeds only
-- the phone can reach (decision 8, 2026-09-22), a checked-in phone through report_live_moment.
-- Both land in fire_reaction_prompt, which dedupes by event key, so three phones seeing the
-- same play fire one prompt.

-- ---------------------------------------------------------------------------
-- 1. The prompt row grows up
-- ---------------------------------------------------------------------------

alter table public.reaction_prompts
  add column source text not null default 'live' check (source in ('live', 'crowd', 'merged', 'scheduled')),
  add column rule text,
  add column event_key text,
  add column label_final text check (label_final is null or char_length(label_final) between 1 and 120),
  add column benefit_side text check (benefit_side is null or benefit_side in ('home', 'away')),
  add column home_score integer,
  add column away_score integer,
  add column wp_seq integer,
  add column period_label text,
  add column relabeled_at timestamptz;
comment on column public.reaction_prompts.label is 'What the prompt said when it fired. An NFL prompt only knows the score changed.';
comment on column public.reaction_prompts.label_final is 'The real play, written overnight from nflverse (ingest/src/nfl/relabel.ts).';
comment on column public.reaction_prompts.significance is 'Win probability swing in points, or 100 for a milestone; kept so the bar can be tuned.';

create unique index reaction_prompts_one_scheduled on public.reaction_prompts (game_id) where kind = 'checkin';
create unique index reaction_prompts_event_key on public.reaction_prompts (game_id, event_key) where event_key is not null;
create unique index reaction_prompts_one_crowd on public.reaction_prompts (game_id) where source = 'crowd';

-- ---------------------------------------------------------------------------
-- 2. Deliveries: one row per prompt per fan it reached
-- ---------------------------------------------------------------------------

create table public.reaction_prompt_deliveries (
  prompt_id uuid not null references public.reaction_prompts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  fired_at timestamptz not null default now(),
  -- The team-aware, situation-aware sentence this person saw.
  copy text not null,
  opened_at timestamptz,
  reacted_at timestamptz,
  primary key (prompt_id, user_id)
);
create index reaction_prompt_deliveries_user_idx on public.reaction_prompt_deliveries (user_id, game_id, fired_at);
alter table public.reaction_prompt_deliveries enable row level security;

create policy reaction_prompt_deliveries_select on public.reaction_prompt_deliveries for select to authenticated
  using (user_id = auth.uid());
-- Opening the camera is the one thing a fan writes here; a reaction sets reacted_at itself.
create policy reaction_prompt_deliveries_update on public.reaction_prompt_deliveries for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.reaction_prompt_deliveries_keep()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.prompt_id := old.prompt_id;
    new.user_id := old.user_id;
    new.game_id := old.game_id;
    new.fired_at := old.fired_at;
    new.copy := old.copy;
    new.reacted_at := old.reacted_at;
    if old.opened_at is not null then new.opened_at := old.opened_at; end if;
  end if;
  return new;
end;
$$;
create trigger reaction_prompt_deliveries_keep before update on public.reaction_prompt_deliveries
  for each row execute function public.reaction_prompt_deliveries_keep();

-- ---------------------------------------------------------------------------
-- 3. Copy templates: one table, editable without a code change
-- ---------------------------------------------------------------------------

-- The scheduled prompt's sentence is built from (score margin bucket, period, rooting side),
-- never free-form (section 2a). `situation` is the margin from the recipient's side:
-- down_big (3+), down (1-2), tied, up (1-2), up_big (3+). `side` is how the fan came to the
-- team: favorite (their own team), pledged (a neutral pick), neutral (no side; audience all).
-- Placeholders: {team}, {other}, {margin}, {period}.
create table public.reaction_copy_templates (
  id integer generated always as identity primary key,
  sport_id text,
  situation text not null check (situation in ('down_big', 'down', 'tied', 'up', 'up_big', 'event')),
  side text not null check (side in ('favorite', 'pledged', 'neutral')),
  template text not null check (char_length(template) between 1 and 200),
  unique (sport_id, situation, side)
);
alter table public.reaction_copy_templates enable row level security;
create policy reaction_copy_templates_select on public.reaction_copy_templates for select to authenticated using (true);

insert into public.reaction_copy_templates (sport_id, situation, side, template) values
  (null, 'down_big', 'favorite', '{team} are down {margin} {period}. Still believe? Let''s see your reaction.'),
  (null, 'down',     'favorite', '{team} are down {margin} {period}. Let''s hope they tie it. Let''s see your reaction.'),
  (null, 'tied',     'favorite', 'Tied {period}, {team} still in it. How are you holding up?'),
  (null, 'up',       'favorite', '{team} up {margin} {period}. How are you holding up?'),
  (null, 'up_big',   'favorite', '{team} up {margin} {period}. Soak it in and show us.'),
  (null, 'down_big', 'pledged',  'You picked {team} and they are down {margin} {period}. React.'),
  (null, 'down',     'pledged',  'You picked {team}, down {margin} {period}. React.'),
  (null, 'tied',     'pledged',  'Tied {period} at a neutral game, you picked {team}. React.'),
  (null, 'up',       'pledged',  'You picked {team}, up {margin} {period}. React.'),
  (null, 'up_big',   'pledged',  'You picked {team} and they are up {margin} {period}. React.'),
  (null, 'down_big', 'neutral',  '{other} lead by {margin} {period}. Show us the crowd.'),
  (null, 'down',     'neutral',  '{other} lead by {margin} {period}. Show us the crowd.'),
  (null, 'tied',     'neutral',  'Tied {period}. Show us the crowd.'),
  (null, 'up',       'neutral',  '{team} lead by {margin} {period}. Show us the crowd.'),
  (null, 'up_big',   'neutral',  '{team} lead by {margin} {period}. Show us the crowd.'),
  (null, 'event',    'favorite', 'Quick, react to {label}.'),
  (null, 'event',    'pledged',  'Quick, react to {label}.'),
  (null, 'event',    'neutral',  'Quick, react to {label}.');

-- "heading into the 8th", "with 9 minutes left", "in the 87th minute": the period phrase the
-- templates take, from the scorebug label the feed produced.
create or replace function public.reaction_period_phrase(p_sport text, p_period_label text)
returns text
language plpgsql
immutable
as $$
declare
  m text[];
begin
  if p_period_label is null or p_period_label = '' then return 'late in the game'; end if;
  if p_sport = 'mlb' then
    m := regexp_match(p_period_label, '^(Top|Bottom|Middle|End)\s+(\S+)');
    if m is not null then
      return case m[1] when 'Top' then 'heading into the ' || m[2] when 'Middle' then 'in the middle of the ' || m[2] else 'in the ' || m[2] end;
    end if;
  elsif p_sport in ('nfl', 'nba') then
    m := regexp_match(p_period_label, '^(Q\d|OT|\dOT)\s+(\d+):(\d+)');
    if m is not null then
      return 'with ' || case when m[2]::int = 0 then 'under a minute' when m[2]::int = 1 then '1 minute' else m[2]::int || ' minutes' end || ' left';
    end if;
  elsif p_sport = 'mls' then
    m := regexp_match(p_period_label, '^(\d+)''');
    if m is not null then return 'in the ' || m[1] || case when m[1]::int % 10 = 1 and m[1]::int <> 11 then 'st' when m[1]::int % 10 = 2 and m[1]::int <> 12 then 'nd' when m[1]::int % 10 = 3 and m[1]::int <> 13 then 'rd' else 'th' end || ' minute'; end if;
  end if;
  return 'late in the game';
end;
$$;

-- "Big" is more than one score in the sport's terms: three runs, more than a touchdown and a
-- two-point try, more than three possessions, two goals.
create or replace function public.reaction_margin_bucket(p_sport text, p_margin integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_margin, 0) = 0 then 'tied'
    when abs(coalesce(p_margin, 0)) >= case p_sport when 'nfl' then 9 when 'nba' then 10 when 'mls' then 2 else 3 end
      then case when p_margin < 0 then 'down_big' else 'up_big' end
    else case when p_margin < 0 then 'down' else 'up' end
  end;
$$;

create or replace function public.reaction_prompt_copy(
  p_sport text, p_kind text, p_label text, p_side text, p_team text, p_other text, p_margin integer, p_period_label text)
returns text
language plpgsql
stable
as $$
declare
  v_situation text;
  v_template text;
begin
  if p_kind = 'event' then
    v_situation := 'event';
  else
    v_situation := public.reaction_margin_bucket(p_sport, p_margin);
  end if;
  select template into v_template from public.reaction_copy_templates
    where situation = v_situation and side = p_side and (sport_id = p_sport or sport_id is null)
    order by sport_id nulls last limit 1;
  if v_template is null then
    return case when p_kind = 'event' then 'Quick, react to ' || p_label || '.' else 'Late in the game. Let''s see your reaction.' end;
  end if;
  return replace(replace(replace(replace(replace(v_template,
    '{team}', coalesce(p_team, 'your team')),
    '{other}', coalesce(p_other, 'the other side')),
    '{margin}', abs(coalesce(p_margin, 0))::text),
    '{period}', public.reaction_period_phrase(p_sport, p_period_label)),
    '{label}', coalesce(p_label, 'this moment'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Firing a prompt
-- ---------------------------------------------------------------------------

-- The side a fan is on at a game: a favorite (or chosen) team on the attendance, or a pledge
-- that has not been voided. Null when neutral with no pick.
create or replace function public.rooting_side_at(p_user uuid, p_game_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when t.team_id = g.home_team_id then 'home'
    when t.team_id = g.away_team_id then 'away'
    else null end
  from public.games g
  left join lateral (
    select coalesce(a.rooting_team_id, p.team_id) as team_id
    from public.attendances a
    left join public.pledges p on p.user_id = a.user_id and p.game_id = a.game_id and p.status <> 'void'
    where a.user_id = p_user and a.game_id = p_game_id
  ) t on true
  where g.id = p_game_id;
$$;
revoke all on function public.rooting_side_at(uuid, uuid) from public, anon, authenticated;

create or replace function public.fire_reaction_prompt(
  p_game_id uuid,
  p_kind text,
  p_label text,
  p_audience text default 'all',
  p_significance numeric default null,
  p_event_key text default null,
  p_window_seconds integer default 120,
  p_home_score integer default null,
  p_away_score integer default null,
  p_period_label text default null,
  p_source text default 'live',
  p_rule text default null,
  p_benefit_side text default null,
  p_in_scheduled_window boolean default false,
  p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  v_kind text := p_kind;
  v_source text := p_source;
  v_prompt_id uuid;
  v_scheduled_fired boolean;
  v_events integer;
  v_delivered integer := 0;
  v_skipped jsonb := '{}'::jsonb;
  r record;
  v_side text;
  v_copy text;
  v_team text;
  v_other text;
  v_margin integer;
  v_last timestamptz;
  v_ignored integer;
  v_rooting_kind text;
  v_skip text;
begin
  if p_kind not in ('checkin', 'event') then raise exception 'bad kind %', p_kind using errcode = 'check_violation'; end if;
  select gm.*, ht.name home_name, at.name away_name into g
  from public.games gm join public.teams ht on ht.id = gm.home_team_id join public.teams at on at.id = gm.away_team_id
  where gm.id = p_game_id;
  if not found then raise exception 'unknown game' using errcode = 'no_data_found'; end if;

  -- Already fired for this play (another phone, or the same one twice).
  if p_event_key is not null then
    select id into v_prompt_id from public.reaction_prompts where game_id = p_game_id and event_key = p_event_key;
    if v_prompt_id is not null then
      return jsonb_build_object('ok', true, 'prompt_id', v_prompt_id, 'delivered', 0, 'duplicate', true);
    end if;
  end if;
  -- Nothing in the first ten minutes, nothing once nobody is there.
  if p_now < g.scheduled_start + interval '10 minutes' then
    return jsonb_build_object('ok', false, 'reason', 'quiet_start');
  end if;
  if not exists (select 1 from public.checkins c where c.game_id = p_game_id and c.ended_at is null) then
    return jsonb_build_object('ok', false, 'reason', 'nobody_here');
  end if;

  select exists (select 1 from public.reaction_prompts where game_id = p_game_id and kind = 'checkin'),
         count(*) filter (where kind = 'event')
    into v_scheduled_fired, v_events
    from public.reaction_prompts where game_id = p_game_id;
  if v_kind = 'checkin' then
    if v_scheduled_fired then return jsonb_build_object('ok', false, 'reason', 'scheduled_fired'); end if;
    if v_source = 'live' then v_source := 'scheduled'; end if;
  else
    if p_in_scheduled_window and not v_scheduled_fired then
      -- The event becomes the check-in prompt; the scheduled one is cancelled by being taken.
      v_kind := 'checkin';
      v_source := 'merged';
    elsif v_events >= 2 then
      return jsonb_build_object('ok', false, 'reason', 'event_cap');
    end if;
  end if;

  insert into public.reaction_prompts (game_id, kind, fired_at, window_seconds, audience, significance, label,
                                       source, rule, event_key, benefit_side, home_score, away_score, period_label)
  values (p_game_id, v_kind, p_now, p_window_seconds, p_audience, p_significance, left(p_label, 120),
          v_source, p_rule, p_event_key, p_benefit_side, p_home_score, p_away_score, p_period_label)
  returning id into v_prompt_id;

  for r in
    select c.user_id, c.prompts_muted, pr.reaction_prompts as prompts_on,
           public.rooting_side_at(c.user_id, p_game_id) as side,
           (select count(*) from public.pledges p where p.user_id = c.user_id and p.game_id = p_game_id and p.status <> 'void') > 0 as pledged
    from public.checkins c
    join public.profiles pr on pr.id = c.user_id
    where c.game_id = p_game_id and c.ended_at is null
  loop
    v_skip := null;
    if not r.prompts_on then v_skip := 'off';
    elsif r.prompts_muted then v_skip := 'muted';
    elsif p_audience <> 'all' and r.side is null then v_skip := 'no_side';
    elsif p_audience <> 'all' and r.side <> p_audience then v_skip := 'wrong_side';
    end if;
    if v_skip is null then
      select max(fired_at) into v_last from public.reaction_prompt_deliveries d where d.user_id = r.user_id and d.game_id = p_game_id;
      if v_last is not null and v_last > p_now - interval '12 minutes' then v_skip := 'too_soon'; end if;
    end if;
    if v_skip is null then
      -- The last two, both unanswered and past their window: silence.
      select count(*) into v_ignored from (
        select d.opened_at, d.reacted_at, d.fired_at, p.window_seconds
        from public.reaction_prompt_deliveries d join public.reaction_prompts p on p.id = d.prompt_id
        where d.user_id = r.user_id and d.game_id = p_game_id
        order by d.fired_at desc limit 2
      ) last2
      where last2.opened_at is null and last2.reacted_at is null and last2.fired_at + make_interval(secs => last2.window_seconds) < p_now;
      if v_ignored >= 2 then v_skip := 'silenced'; end if;
    end if;
    if v_skip is not null then
      v_skipped := v_skipped || jsonb_build_object(v_skip, coalesce((v_skipped ->> v_skip)::int, 0) + 1);
      continue;
    end if;

    v_side := r.side;
    v_rooting_kind := case when v_side is null then 'neutral' when r.pledged and not exists (
        select 1 from public.attendances a where a.user_id = r.user_id and a.game_id = p_game_id and a.rooting_team_id is not null
      ) then 'pledged' else 'favorite' end;
    v_team := case when v_side = 'away' then g.away_name else g.home_name end;
    v_other := case when v_side = 'away' then g.home_name else g.away_name end;
    v_margin := case when v_side = 'away' then coalesce(p_away_score, 0) - coalesce(p_home_score, 0)
                     else coalesce(p_home_score, 0) - coalesce(p_away_score, 0) end;
    v_copy := public.reaction_prompt_copy(g.sport_id, case when v_source = 'scheduled' then 'checkin' else 'event' end,
                                          p_label, v_rooting_kind, v_team, v_other, v_margin, p_period_label);
    insert into public.reaction_prompt_deliveries (prompt_id, user_id, game_id, fired_at, copy)
    values (v_prompt_id, r.user_id, p_game_id, p_now, v_copy);
    insert into public.notifications (user_id, kind, title, body, data, created_at)
    values (r.user_id, 'reaction_prompt', 'React now', v_copy,
            jsonb_build_object('game_id', p_game_id, 'prompt_id', v_prompt_id), p_now);
    v_delivered := v_delivered + 1;
  end loop;

  return jsonb_build_object('ok', true, 'prompt_id', v_prompt_id, 'kind', v_kind, 'source', v_source,
                            'delivered', v_delivered, 'skipped', v_skipped);
end;
$$;
revoke all on function public.fire_reaction_prompt(uuid, text, text, text, numeric, text, integer, integer, integer, text, text, text, text, boolean, timestamptz) from public, anon, authenticated;

-- The phone's way in, for the feeds only it can read: a fan with an open session at the game
-- reports a moment the rules in packages/core let through. The same gate and dedupe apply, so
-- three phones seeing the same play fire one prompt, and a game never gets more than three.
create or replace function public.report_live_moment(
  p_game_id uuid,
  p_kind text,
  p_label text,
  p_audience text default 'all',
  p_significance numeric default null,
  p_event_key text default null,
  p_home_score integer default null,
  p_away_score integer default null,
  p_period_label text default null,
  p_rule text default null,
  p_benefit_side text default null,
  p_in_scheduled_window boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sport text;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  if not exists (select 1 from public.checkins c where c.user_id = v_uid and c.game_id = p_game_id and c.ended_at is null) then
    return jsonb_build_object('ok', false, 'reason', 'not_checked_in');
  end if;
  select sport_id into v_sport from public.games where id = p_game_id;
  -- MLB is the server's (mlb-live); a phone never fires an MLB prompt.
  if v_sport = 'mlb' then return jsonb_build_object('ok', false, 'reason', 'server_sport'); end if;
  return public.fire_reaction_prompt(
    p_game_id, p_kind, p_label, p_audience, p_significance,
    coalesce(p_event_key, case when p_kind = 'checkin' then 'scheduled' else null end),
    120, p_home_score, p_away_score, p_period_label, 'live', p_rule, p_benefit_side, p_in_scheduled_window, now());
end;
$$;
revoke all on function public.report_live_moment(uuid, text, text, text, numeric, text, integer, integer, text, text, text, boolean) from public, anon;
grant execute on function public.report_live_moment(uuid, text, text, text, numeric, text, integer, integer, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reactions: the capture's server-side truths, the self-trigger cap, the crowd signal
-- ---------------------------------------------------------------------------

alter table public.reactions add column self_triggered boolean not null default false;

create or replace function public.reactions_keep_capture()
returns trigger
language plpgsql
as $$
declare
  v_prompt record;
  v_self integer;
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.captured_at := now();
      if new.prompt_id is null then
        new.self_triggered := true;
        select count(*) into v_self from public.reactions r
          where r.user_id = new.user_id and r.game_id = new.game_id and r.self_triggered;
        if v_self >= 5 then
          raise exception 'five self-triggered reactions a game' using errcode = 'check_violation';
        end if;
        new.late_seconds := null;
      else
        select * into v_prompt from public.reaction_prompts p where p.id = new.prompt_id;
        if v_prompt.game_id is distinct from new.game_id then
          raise exception 'that prompt is for another game' using errcode = 'check_violation';
        end if;
        new.self_triggered := false;
        -- How late, by the server clock: what "late by 4 min" is built from.
        new.late_seconds := greatest(0, floor(extract(epoch from (now() - v_prompt.fired_at))))::integer;
        new.wp_seq := coalesce(new.wp_seq, v_prompt.wp_seq);
        new.period_label := coalesce(new.period_label, v_prompt.period_label);
      end if;
    else
      new.id := old.id;
      new.user_id := old.user_id;
      new.game_id := old.game_id;
      new.prompt_id := old.prompt_id;
      new.attendance_id := old.attendance_id;
      new.back_path := old.back_path;
      new.front_path := old.front_path;
      new.captured_at := old.captured_at;
      new.late_seconds := old.late_seconds;
      new.self_triggered := old.self_triggered;
    end if;
    if new.post_id is not null and public.post_author(new.post_id) is distinct from new.user_id then
      raise exception 'a reaction can only be attached to its author''s post' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- After a capture: the delivery is answered, and three self-triggers in 90 seconds by three
-- fans is a crowd moment for everyone else there.
create or replace function public.reactions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fans integer;
begin
  if new.prompt_id is not null then
    update public.reaction_prompt_deliveries set reacted_at = new.captured_at
      where prompt_id = new.prompt_id and user_id = new.user_id and reacted_at is null;
  elsif new.self_triggered then
    select count(distinct user_id) into v_fans from public.reactions r
      where r.game_id = new.game_id and r.self_triggered and r.captured_at >= new.captured_at - interval '90 seconds';
    if v_fans >= 3 and not exists (select 1 from public.reaction_prompts p where p.game_id = new.game_id and p.source = 'crowd') then
      perform public.fire_reaction_prompt(new.game_id, 'event', 'the moment everyone around you is reacting to', 'all',
        100, 'crowd', 120, null, null, new.period_label, 'crowd', 'crowd_signal', null, false, new.captured_at);
    end if;
  end if;
  return new;
end;
$$;
create trigger reactions_after_insert after insert on public.reactions
  for each row execute function public.reactions_after_insert();

-- Pin reactions to the win probability line once it exists: the last point at or before the
-- capture, for reactions with no point yet. Called by the relive and relabel jobs.
create or replace function public.pin_reactions(p_game_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer := 0;
begin
  update public.reactions r
    set wp_seq = t.seq
    from lateral (
      select seq from public.game_wp_timeline w
      where w.game_id = r.game_id and w.occurred_at is not null and w.occurred_at <= r.captured_at
      order by w.occurred_at desc limit 1
    ) t
    where r.game_id = p_game_id and r.wp_seq is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.pin_reactions(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Photos: a private bucket, read through the reaction's own visibility
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reaction-photos', 'reaction-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

create policy reaction_photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'reaction-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy reaction_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'reaction-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Mine, or one whose post I may see (posts carry the follower and public rules, and blocks).
create or replace function public.can_view_reaction(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reactions r
    where r.id = p_id and auth.uid() is not null
      and (r.user_id = auth.uid() or (r.post_id is not null and public.can_view_post(r.post_id)))
  );
$$;

create policy reaction_photos_object_select on storage.objects for select to authenticated
  using (
    bucket_id = 'reaction-photos'
    and exists (
      select 1 from public.reactions r
      where (r.back_path = storage.objects.name or r.front_path = storage.objects.name)
        and public.can_view_reaction(r.id)
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Reads: a game's reactions, mine always, others' by their post
-- ---------------------------------------------------------------------------

create or replace function public.game_reactions(p_game_id uuid, p_limit integer default 60)
returns table (
  id uuid, user_id uuid, handle text, display_name text, avatar_path text,
  prompt_id uuid, label text, captured_at timestamptz, late_seconds integer, self_triggered boolean,
  wp_seq integer, period_label text, back_path text, front_path text, visibility text, post_id uuid, mine boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.user_id, pr.handle, pr.display_name, pr.avatar_path,
         r.prompt_id, coalesce(p.label_final, p.label), r.captured_at, r.late_seconds, r.self_triggered,
         r.wp_seq, r.period_label, r.back_path, r.front_path, r.visibility, r.post_id, r.user_id = auth.uid()
  from public.reactions r
  join public.profiles pr on pr.id = r.user_id
  left join public.reaction_prompts p on p.id = r.prompt_id
  where r.game_id = p_game_id
    and auth.uid() is not null
    and (r.user_id = auth.uid() or (r.post_id is not null and public.can_view_post(r.post_id)))
  order by r.captured_at
  limit p_limit;
$$;
revoke all on function public.game_reactions(uuid, integer) from public, anon;
grant execute on function public.game_reactions(uuid, integer) to authenticated;

-- The data export carries the prompts a fan was sent, beside their reactions (20260924000500).
do $$
declare
  v_def text;
  v_anchor text := $f$'reactions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.reactions r where r.user_id = auth.uid())$f$;
begin
  select pg_get_functiondef('public.export_my_data'::regproc) into v_def;
  if position(v_anchor in v_def) = 0 then
    raise exception 'export_my_data(): the reactions entry from 20260924000500 is missing';
  end if;
  execute replace(v_def, v_anchor, v_anchor || $f$,
    'reaction_prompt_deliveries', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.reaction_prompt_deliveries d where d.user_id = auth.uid())$f$);
end;
$$;
