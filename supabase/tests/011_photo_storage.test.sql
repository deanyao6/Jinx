-- The attendance-photos bucket (SPEC.md 6.19, 9). The table policies are tested in 006; these are
-- the storage.objects policies, which are what actually guard the file. A photo is only private
-- if its bytes are, whatever the metadata row says.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('b1000000-0000-4000-8000-0000000000b1', 'owner@example.com'),
  ('b1000000-0000-4000-8000-0000000000b2', 'stranger@example.com');
insert into public.profiles (id, handle, display_name) values
  ('b1000000-0000-4000-8000-0000000000b1', 'photo_owner', 'Owner'),
  ('b1000000-0000-4000-8000-0000000000b2', 'photo_stranger', 'Stranger')
on conflict (id) do nothing;
insert into public.venues (id, key, name) values ('00000000-0000-0000-0000-000000000bb1', 'photo-park', 'Photo Park');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-000000000ba1', 'mlb', 'Photo Home', 'Home', 'PHH', 'test', 'photo-h', 'photo-fh'),
  ('00000000-0000-0000-0000-000000000ba2', 'mlb', 'Photo Away', 'Away', 'PHA', 'test', 'photo-a', 'photo-fa');
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id)
values ('00000000-0000-0000-0000-000000000bc1', 'mlb', 2025, 'regular', '2025-06-01T23:05:00Z', '00000000-0000-0000-0000-000000000bb1',
        '00000000-0000-0000-0000-000000000ba1', '00000000-0000-0000-0000-000000000ba2', 'final', 4, 2, 'test', 'photo-g1');
insert into public.attendances (id, user_id, game_id, status, source)
values ('00000000-0000-0000-0000-000000000bd1', 'b1000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000bc1', 'attended', 'manual');

-- The owner uploads two files, the way the app names them: <user>/<attendance>/<uuid>.<ext>.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-0000000000b1","role":"authenticated"}';

select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values
  ('attendance-photos', 'b1000000-0000-4000-8000-0000000000b1/00000000-0000-0000-0000-000000000bd1/public.jpg', 'b1000000-0000-4000-8000-0000000000b1'),
  ('attendance-photos', 'b1000000-0000-4000-8000-0000000000b1/00000000-0000-0000-0000-000000000bd1/private.jpg', 'b1000000-0000-4000-8000-0000000000b1')$$,
  'a user can upload into their own folder');

select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values
  ('attendance-photos', 'b1000000-0000-4000-8000-0000000000b2/x/planted.jpg', 'b1000000-0000-4000-8000-0000000000b1')$$,
  '42501', null, 'and not into anyone else''s');

insert into public.attendance_photos (attendance_id, user_id, storage_path, kind, visibility) values
  ('00000000-0000-0000-0000-000000000bd1', 'b1000000-0000-4000-8000-0000000000b1',
   'b1000000-0000-4000-8000-0000000000b1/00000000-0000-0000-0000-000000000bd1/public.jpg', 'photo', 'public'),
  ('00000000-0000-0000-0000-000000000bd1', 'b1000000-0000-4000-8000-0000000000b1',
   'b1000000-0000-4000-8000-0000000000b1/00000000-0000-0000-0000-000000000bd1/private.jpg', 'photo', 'private');

select is((select count(*)::int from storage.objects where bucket_id = 'attendance-photos'
           and name like 'b1000000-0000-4000-8000-0000000000b1/%'), 2, 'the owner can read both of their files');

-- A stranger: not a follower, not blocked.
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-0000000000b2","role":"authenticated"}';

select is((select array_agg(name order by name) from storage.objects where bucket_id = 'attendance-photos'
           and name like 'b1000000-0000-4000-8000-0000000000b1/%'),
  array['b1000000-0000-4000-8000-0000000000b1/00000000-0000-0000-0000-000000000bd1/public.jpg'],
  'a stranger can read the public file and not the private one');

select is((select count(*)::int from public.game_fan_photos('00000000-0000-0000-0000-000000000bc1')), 1,
  'and the public one is what From fans at this game shows them');

-- The Storage API sets this before it deletes; without it a statement-level guard refuses every
-- direct delete, which would make this pass for the wrong reason.
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'attendance-photos' and name like 'b1000000-0000-4000-8000-0000000000b1/%';
select is((select count(*)::int from storage.objects where bucket_id = 'attendance-photos'
           and name like 'b1000000-0000-4000-8000-0000000000b1/%'), 1,
  'a stranger cannot delete someone else''s file');

-- The owner makes the photo private again: the file goes dark with the row.
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
update public.attendance_photos set visibility = 'private' where storage_path like '%/public.jpg';
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
select is((select count(*)::int from storage.objects where bucket_id = 'attendance-photos'
           and name like 'b1000000-0000-4000-8000-0000000000b1/%'), 0,
  'revoking visibility revokes the file itself, not just its row');
select is((select count(*)::int from public.game_fan_photos('00000000-0000-0000-0000-000000000bc1')), 0,
  'and it leaves the fan feed');

reset role;
set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'attendance-photos'), 0,
  'a signed-out caller sees no photo files at all');

select * from finish();
rollback;
