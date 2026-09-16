-- Every count below is scoped to this file's own fixture rows.
--
-- They used to count whole tables, which only worked while those tables were empty. They are
-- not: supabase/seed.sql now loads 65 team palettes and 224 venue shapes, and any ingest run
-- fills game_wp_timeline and game_story_steps. A test that says "authenticated reads
-- venue_shapes" should assert exactly that, not that the database is otherwise bare.
--
-- RLS and behaviour for the tables added with spec revision 7:
-- team_colors, venue_shapes, game_wp_timeline, game_story_steps, storylines,
-- detail_queue, attendance_photos (SPEC.md 4.7, 5.1, 5.2, 6.18, 6.19).
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- ---------------------------------------------------------------------------
-- Fixtures, written as postgres (which bypasses RLS).
--   alice  public
--   bob    public, followed by alice (so alice is a follower of bob)
--   carol  private
--   dave   public, blocked by alice
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-4000-8000-0000000000a1', 'alice@example.com', '{}'),
  ('b2000000-0000-4000-8000-0000000000b2', 'bob@example.com', '{}'),
  ('c3000000-0000-4000-8000-0000000000c3', 'carol@example.com', '{}'),
  ('d4000000-0000-4000-8000-0000000000d4', 'dave@example.com', '{}');

update public.profiles set is_private = true where id = 'c3000000-0000-4000-8000-0000000000c3';
insert into public.blocks (blocker_id, blocked_id) values ('a1000000-0000-4000-8000-0000000000a1', 'd4000000-0000-4000-8000-0000000000d4');
-- alice follows bob; bob is public so the follow is active immediately.
insert into public.follows (follower_id, followee_id, status) values ('a1000000-0000-4000-8000-0000000000a1', 'b2000000-0000-4000-8000-0000000000b2', 'active');

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-00000000a001', 'mlb', 'Philadelphia Phillies', 'Philadelphia', 'PHI', 'test', 'phi', 'mlb-143'),
       ('00000000-0000-0000-0000-00000000a002', 'mlb', 'New York Mets', 'New York', 'NYM', 'test', 'nym', 'mlb-121');
insert into public.venues (id, key, name, lat, lng) values ('00000000-0000-0000-0000-00000000b001', 'cbp', 'Citizens Bank Park', 39.9057, -75.1665);
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id)
values ('00000000-0000-0000-0000-00000000c001', 'mlb', 2024, 'regular', '2024-09-15T17:35:00Z', '00000000-0000-0000-0000-00000000b001',
        '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', 'final', 5, 2, 'test', 'g1'),
       ('00000000-0000-0000-0000-00000000c002', 'mlb', 2026, 'regular', '2099-09-15T17:35:00Z', '00000000-0000-0000-0000-00000000b001',
        '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', 'scheduled', null, null, 'test', 'g2');

insert into public.team_colors (team_id, fill_hex, on_fill_hex, primary_light_hex, secondary_light_hex, primary_dark_hex, secondary_dark_hex, source)
values ('00000000-0000-0000-0000-00000000a001', '#E81828', '#FFFFFF', '#BA0C2F', '#7A0A1E', '#FF6B7A', '#C4455A', 'reference');
insert into public.venue_shapes (venue_id, shape_key) values ('00000000-0000-0000-0000-00000000b001', 'ballparkA');
insert into public.game_wp_timeline (game_id, seq, period, half, home_wp) values
  ('00000000-0000-0000-0000-00000000c001', 0, 1, 'top', 0.54),
  ('00000000-0000-0000-0000-00000000c001', 1, 9, 'bottom', 0.97);
insert into public.game_story_steps (game_id, seq, wp_seq, away_score, home_score, label, text) values
  ('00000000-0000-0000-0000-00000000c001', 0, 0, 0, 0, 'Pregame', 'The Phillies open at 54 percent.'),
  ('00000000-0000-0000-0000-00000000c001', 1, 1, 2, 5, 'Bot 9th', 'Philadelphia closes it out.');
insert into public.storylines (game_id, team_id, text, source) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a001', 'Philadelphia has won six straight at home.', 'results');

-- ---------------------------------------------------------------------------
-- Reference data: anon is shut out, authenticated can read, nobody can write.
-- ---------------------------------------------------------------------------
set local role anon;
select is((select count(*) from public.team_colors), 0::bigint, 'anon cannot read team_colors');
select is((select count(*) from public.venue_shapes), 0::bigint, 'anon cannot read venue_shapes');
select is((select count(*) from public.game_wp_timeline), 0::bigint, 'anon cannot read game_wp_timeline');
select is((select count(*) from public.game_story_steps), 0::bigint, 'anon cannot read game_story_steps');
select is((select count(*) from public.storylines), 0::bigint, 'anon cannot read storylines');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*) from public.team_colors where team_id = '00000000-0000-0000-0000-00000000a001'), 1::bigint, 'authenticated reads team_colors');
select is((select primary_dark_hex from public.team_colors where team_id = '00000000-0000-0000-0000-00000000a001'), '#FF6B7A', 'dark variant is stored, not derived');
select is((select count(*) from public.venue_shapes where venue_id = '00000000-0000-0000-0000-00000000b001'), 1::bigint, 'authenticated reads venue_shapes');
select is((select count(*) from public.game_wp_timeline where game_id = '00000000-0000-0000-0000-00000000c001'), 2::bigint, 'authenticated reads game_wp_timeline');
select is((select count(*) from public.game_story_steps where game_id = '00000000-0000-0000-0000-00000000c001'), 2::bigint, 'authenticated reads game_story_steps');
select is((select count(*) from public.storylines where game_id = '00000000-0000-0000-0000-00000000c001'), 1::bigint, 'authenticated reads storylines');

select throws_ok($$insert into public.team_colors (team_id, fill_hex, on_fill_hex, primary_light_hex, secondary_light_hex, primary_dark_hex, secondary_dark_hex)
  values ('00000000-0000-0000-0000-00000000a002', '#002D72', '#FFFFFF', '#002D72', '#FF5910', '#5B8FD9', '#FF5910')$$,
  '42501', null, 'authenticated cannot write team_colors');
select throws_ok($$insert into public.venue_shapes (venue_id, shape_key) values ('00000000-0000-0000-0000-00000000b001', 'bowl')$$,
  '42501', null, 'authenticated cannot write venue_shapes');
select throws_ok($$insert into public.storylines (game_id, team_id, text, source) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a002', 'x', 'results')$$,
  '42501', null, 'authenticated cannot write storylines');
select throws_ok($$insert into public.game_wp_timeline (game_id, seq, period, home_wp) values ('00000000-0000-0000-0000-00000000c001', 2, 1, 0.5)$$,
  '42501', null, 'authenticated cannot write game_wp_timeline');
select throws_ok($$insert into public.game_story_steps (game_id, seq, wp_seq, away_score, home_score, label, text) values ('00000000-0000-0000-0000-00000000c001', 2, 0, 0, 0, 'x', 'y')$$,
  '42501', null, 'authenticated cannot write game_story_steps');
reset role;

-- ---------------------------------------------------------------------------
-- detail_queue: service role only, and populated by triggers.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
-- Logging a game queues its detail, but the queue itself stays invisible.
insert into public.attendances (id, user_id, game_id, source) values
  ('00000000-0000-0000-0000-00000000d001', 'a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'manual');
select is((select count(*) from public.detail_queue), 0::bigint, 'detail_queue is invisible to authenticated users');
select throws_ok($$insert into public.detail_queue (game_id, reason) values ('00000000-0000-0000-0000-00000000c002', 'going')$$,
  '42501', null, 'authenticated cannot write detail_queue');
reset role;

select is((select reason from public.detail_queue where game_id = '00000000-0000-0000-0000-00000000c001'), 'attendance',
  'creating an attendance queues that game for detail');

-- A future game is queued but is not yet work for the detail worker (SPEC.md 4.7).
select public.enqueue_game_detail('00000000-0000-0000-0000-00000000c002', 'going');
select is((select count(*) from public.detail_queue where game_id in ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c002')), 2::bigint, 'a future game is queued');
select is((select count(*) from public.detail_queue_pending('test') where game_id in ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c002')), 1::bigint, 'only final games are pending work');

-- An already-ingested game is not re-queued except by an explicit refresh.
update public.games set detail_ingested_at = now() where id = '00000000-0000-0000-0000-00000000c001';
update public.detail_queue set done_at = now() where game_id = '00000000-0000-0000-0000-00000000c001';
select public.enqueue_game_detail('00000000-0000-0000-0000-00000000c001', 'attendance');
select ok((select done_at is not null from public.detail_queue where game_id = '00000000-0000-0000-0000-00000000c001'),
  'an ingested game is not re-queued by a second attendance');
select public.enqueue_game_detail('00000000-0000-0000-0000-00000000c001', 'refresh');
select ok((select done_at is null from public.detail_queue where game_id = '00000000-0000-0000-0000-00000000c001'),
  'refresh re-opens an ingested game');

-- ---------------------------------------------------------------------------
-- attendance_photos: Section 9 visibility.
-- ---------------------------------------------------------------------------
insert into public.attendances (id, user_id, game_id, source) values
  ('00000000-0000-0000-0000-00000000d002', 'b2000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-00000000c001', 'manual'),
  ('00000000-0000-0000-0000-00000000d003', 'c3000000-0000-4000-8000-0000000000c3', '00000000-0000-0000-0000-00000000c001', 'manual'),
  ('00000000-0000-0000-0000-00000000d004', 'd4000000-0000-4000-8000-0000000000d4', '00000000-0000-0000-0000-00000000c001', 'manual');

insert into public.attendance_photos (id, attendance_id, user_id, storage_path, kind, visibility) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d002', 'b2000000-0000-4000-8000-0000000000b2', 'b2000000-0000-4000-8000-0000000000b2/pub.jpg',  'photo', 'public'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000d002', 'b2000000-0000-4000-8000-0000000000b2', 'b2000000-0000-4000-8000-0000000000b2/fol.jpg',  'photo', 'followers'),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000d002', 'b2000000-0000-4000-8000-0000000000b2', 'b2000000-0000-4000-8000-0000000000b2/priv.jpg', 'photo', 'private'),
  ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-00000000d003', 'c3000000-0000-4000-8000-0000000000c3', 'c3000000-0000-4000-8000-0000000000c3/pub.jpg',  'photo', 'public'),
  ('00000000-0000-0000-0000-00000000f005', '00000000-0000-0000-0000-00000000d004', 'd4000000-0000-4000-8000-0000000000d4', 'd4000000-0000-4000-8000-0000000000d4/pub.jpg',  'photo', 'public');

-- alice follows bob, is blocked from dave, and does not follow private carol.
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select ok((select count(*) = 1 from public.attendance_photos where id = '00000000-0000-0000-0000-00000000f001'), 'follower sees a public photo');
select ok((select count(*) = 1 from public.attendance_photos where id = '00000000-0000-0000-0000-00000000f002'), 'follower sees a followers-only photo');
select is((select count(*) from public.attendance_photos where id = '00000000-0000-0000-0000-00000000f003'), 0::bigint, 'a private photo stays private');
select is((select count(*) from public.attendance_photos where id = '00000000-0000-0000-0000-00000000f004'), 0::bigint, 'a public photo on a private account is hidden');
select is((select count(*) from public.attendance_photos where id = '00000000-0000-0000-0000-00000000f005'), 0::bigint, 'a blocked user photo is hidden');

-- "From fans at this game" applies the same rules and excludes your own photos.
select is((select count(*) from public.game_fan_photos('00000000-0000-0000-0000-00000000c001')), 1::bigint,
  'game_fan_photos returns only public items from public, unblocked, other users');

select throws_ok($$insert into public.attendance_photos (attendance_id, user_id, storage_path, kind)
  values ('00000000-0000-0000-0000-00000000d002', 'a1000000-0000-4000-8000-0000000000a1', 'x/y.jpg', 'photo')$$,
  '42501', null, 'cannot attach a photo to someone else attendance');
select throws_ok($$insert into public.attendance_photos (attendance_id, user_id, storage_path, kind)
  values ('00000000-0000-0000-0000-00000000d001', 'b2000000-0000-4000-8000-0000000000b2', 'z/y.jpg', 'photo')$$,
  '42501', null, 'cannot post a photo as another user');
-- An UPDATE the policy hides does not raise: it simply matches no rows. Assert the
-- row is untouched rather than asserting an error that Postgres never raises.
update public.attendance_photos set visibility = 'public' where id = '00000000-0000-0000-0000-00000000f003';
reset role;
select is((select visibility from public.attendance_photos where id = '00000000-0000-0000-0000-00000000f003'), 'private',
  'cannot change the visibility of someone else photo');

-- bob sees all three of his own, whatever their visibility.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b2000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
select is((select count(*) from public.attendance_photos where user_id = 'b2000000-0000-4000-8000-0000000000b2'), 3::bigint, 'owner sees all own photos');
select lives_ok($$update public.attendance_photos set visibility = 'public' where id = '00000000-0000-0000-0000-00000000f003'$$, 'owner can change own visibility');
select lives_ok($$delete from public.attendance_photos where id = '00000000-0000-0000-0000-00000000f003'$$, 'owner can delete own photo');
reset role;

select * from finish();
rollback;
