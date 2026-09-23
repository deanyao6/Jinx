-- Companion consent, both paths (migration 20260924010400; social brief 02, section 7;
-- 00_repo_reality.md R5).
--   Placeholder ("Dad", no account): confirmed at once, no notification, no pending state,
--   shows on the post. Unchanged from before consent existed.
--   Linked user: pending, asked "Dean says you were at ... Add it?", invisible to them until
--   they answer; accept logs the game for them and drafts a post if their auto-post is on;
--   decline removes the tag, tells nobody, and a re-tag is dropped silently; a blocked tagger's
--   tag never lands.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data) values
  ('b7500000-0000-4000-8000-0000000000a1', 'cf-dean@test', '{"full_name":"Dean"}'),
  ('b7500000-0000-4000-8000-0000000000b1', 'cf-maya@test', '{"full_name":"Maya"}'),
  ('b7500000-0000-4000-8000-0000000000c1', 'cf-jo@test', '{"full_name":"Jo"}'),
  ('b7500000-0000-4000-8000-0000000000d1', 'cf-follower@test', '{"full_name":"Follower"}');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id, nickname) values
  ('00000000-0000-0000-0000-00000075a001', 'mlb', 'Philadelphia Phillies', 'Philadelphia', 'PHI', 'test', 'cf-t1', 'cf-f1', 'Phillies'),
  ('00000000-0000-0000-0000-00000075a002', 'mlb', 'New York Mets', 'New York', 'NYM', 'test', 'cf-t2', 'cf-f2', 'Mets');
insert into public.venues (id, key, name, city, tz) values ('00000000-0000-0000-0000-00000075b001', 'cf-park', 'Citizens Test Park', 'Philadelphia', 'America/New_York');
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000075c001', 'mlb', 2026, 'regular', '2026-09-20T23:05:00Z', '00000000-0000-0000-0000-00000075b001', '00000000-0000-0000-0000-00000075a001', '00000000-0000-0000-0000-00000075a002', 'final', 'test', 'cf-g1');
insert into public.attendances (id, user_id, game_id, source) values
  ('b7500000-0000-4000-8000-0000000000e1', 'b7500000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000075c001', 'manual');
insert into public.follows (follower_id, followee_id) values ('b7500000-0000-4000-8000-0000000000d1', 'b7500000-0000-4000-8000-0000000000a1');
insert into public.people (id, owner_user_id, display_name, linked_user_id) values
  ('b7500000-0000-4000-8000-0000000000f1', 'b7500000-0000-4000-8000-0000000000a1', 'Dad', null),
  ('b7500000-0000-4000-8000-0000000000f2', 'b7500000-0000-4000-8000-0000000000a1', 'Maya', 'b7500000-0000-4000-8000-0000000000b1'),
  ('b7500000-0000-4000-8000-0000000000f3', 'b7500000-0000-4000-8000-0000000000a1', 'Jo', 'b7500000-0000-4000-8000-0000000000c1');
insert into public.posts (id, author_id, kind, attendance_id, visibility, created_at, published_at) values
  ('b7500000-0000-4000-8000-000000000f99', 'b7500000-0000-4000-8000-0000000000a1', 'game', 'b7500000-0000-4000-8000-0000000000e1', 'followers', now(), now());
insert into public.blocks (blocker_id, blocked_id) values ('b7500000-0000-4000-8000-0000000000c1', 'b7500000-0000-4000-8000-0000000000a1');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b7500000-0000-4000-8000-0000000000a1","role":"authenticated"}';
insert into public.attendance_companions (attendance_id, person_id) values
  ('b7500000-0000-4000-8000-0000000000e1', 'b7500000-0000-4000-8000-0000000000f1'),
  ('b7500000-0000-4000-8000-0000000000e1', 'b7500000-0000-4000-8000-0000000000f2'),
  ('b7500000-0000-4000-8000-0000000000e1', 'b7500000-0000-4000-8000-0000000000f3');
reset role;

-- ---- The placeholder path: exactly as before ----
select is((select status from public.attendance_companions where person_id = 'b7500000-0000-4000-8000-0000000000f1'), 'confirmed',
  'Dad, with no account, is confirmed at once');
select is((select count(*)::integer from public.notifications n where n.data ->> 'person_id' = 'b7500000-0000-4000-8000-0000000000f1'), 0,
  'and nobody is notified');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7500000-0000-4000-8000-0000000000d1","role":"authenticated"}';
select is((select companions from public.post_card('b7500000-0000-4000-8000-000000000f99')), '[{"name": "Dad", "handle": null}]'::jsonb,
  'a follower sees Dad on the post, and not the pending tag');
reset role;

-- ---- The linked path ----
select is((select status from public.attendance_companions where person_id = 'b7500000-0000-4000-8000-0000000000f2'), 'pending',
  'Maya, a real user, starts pending');
select is((select body from public.notifications where user_id = 'b7500000-0000-4000-8000-0000000000b1' and kind = 'tagged'),
  'Dean says you were at Mets at Phillies, Sep 20. Add it?', 'and is asked');
select is((select count(*)::integer from public.attendance_companions where person_id = 'b7500000-0000-4000-8000-0000000000f3'), 0,
  'a tag of someone who blocked the tagger never lands');
select is((select count(*)::integer from public.notifications where user_id = 'b7500000-0000-4000-8000-0000000000c1'), 0,
  'and asks them nothing');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b7500000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*)::integer from public.my_tags_at_game('00000000-0000-0000-0000-00000075c001')), 0,
  'pending, the tag is not on Maya''s game page');
select is((select count(*)::integer from public.tagged_games_for_me('b7500000-0000-4000-8000-0000000000a1')), 0,
  'nor in her tagged games');
select is((select count(*)::integer from public.attendances where user_id = 'b7500000-0000-4000-8000-0000000000b1'), 0,
  'nor in her records: no attendance exists for her');
select is((select tagger_display_name from public.my_pending_tags()), 'Dean', 'only in the question itself');

-- Accept.
select is(public.answer_companion_tag('b7500000-0000-4000-8000-0000000000e1', 'b7500000-0000-4000-8000-0000000000f2', true), 'confirmed', 'Maya accepts');
select ok((select source = 'manual' and not verified from public.attendances
           where user_id = 'b7500000-0000-4000-8000-0000000000b1' and game_id = '00000000-0000-0000-0000-00000075c001'),
  'the game is logged for her, manual and unverified');
select ok((select published_at is null and publish_at > now() from public.posts where author_id = 'b7500000-0000-4000-8000-0000000000b1' and kind = 'game'),
  'her auto-post is on, so a draft waits out its edit window');
select is((select count(*)::integer from public.my_tags_at_game('00000000-0000-0000-0000-00000075c001')), 1,
  'confirmed, the tag shows on her game page');
reset role;

-- ---- Decline, and the silent block on re-tagging ----
delete from public.companion_declines;
insert into public.attendances (id, user_id, game_id, source) values
  ('b7500000-0000-4000-8000-0000000000e2', 'b7500000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-00000075c001', 'manual');
insert into public.people (id, owner_user_id, display_name, linked_user_id) values
  ('b7500000-0000-4000-8000-0000000000f4', 'b7500000-0000-4000-8000-0000000000d1', 'Maya C', 'b7500000-0000-4000-8000-0000000000b1');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7500000-0000-4000-8000-0000000000d1","role":"authenticated"}';
insert into public.attendance_companions (attendance_id, person_id) values ('b7500000-0000-4000-8000-0000000000e2', 'b7500000-0000-4000-8000-0000000000f4');
set local request.jwt.claims to '{"sub":"b7500000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is(public.answer_companion_tag('b7500000-0000-4000-8000-0000000000e2', 'b7500000-0000-4000-8000-0000000000f4', false), 'declined', 'Maya declines the second tagger');
reset role;
select is((select count(*)::integer from public.attendance_companions where person_id = 'b7500000-0000-4000-8000-0000000000f4'), 0,
  'the tag is gone');
select results_eq(
  $$select kind from public.notifications where user_id = 'b7500000-0000-4000-8000-0000000000d1'$$,
  $$values ('new_stamp'::text)$$,
  'the tagger is told nothing: their only notification is the stamp for logging the game');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7500000-0000-4000-8000-0000000000d1","role":"authenticated"}';
insert into public.attendance_companions (attendance_id, person_id) values ('b7500000-0000-4000-8000-0000000000e2', 'b7500000-0000-4000-8000-0000000000f4');
reset role;
select is((select count(*)::integer from public.attendance_companions where person_id = 'b7500000-0000-4000-8000-0000000000f4'), 0,
  'tagging her again at that game is dropped without an error');

select * from finish();
rollback;
