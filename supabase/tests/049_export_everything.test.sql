-- export_my_data holds everything Jinx keeps about a fan (migration 20260923000400): the keys
-- added since the first version are present and carry this user's rows and nobody else's.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role)
values ('a1000000-0000-4000-8000-0000000000e1', 'export-me@test', 'authenticated', 'authenticated'),
       ('a1000000-0000-4000-8000-0000000000e2', 'export-them@test', 'authenticated', 'authenticated')
on conflict (id) do nothing;
insert into public.profiles (id, handle, display_name, is_private)
values ('a1000000-0000-4000-8000-0000000000e1', 'exportme', 'Export Me', false),
       ('a1000000-0000-4000-8000-0000000000e2', 'exportthem', 'Export Them', false)
-- The auth.users trigger already made a profile with a generated handle; the test needs these.
on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name;

insert into public.venues (id, key, name, city) values ('00000000-0000-0000-0000-0000000000eb', 'export-venue', 'Export Park', 'Exportville')
on conflict (key) do nothing;
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-0000000000ea', 'mls', 'Export FC', 'Exportville', 'EXP', 'test', 'exp-t1', 'exp-f1'),
       ('00000000-0000-0000-0000-0000000000ed', 'mls', 'Other FC', 'Elsewhere', 'OTF', 'test', 'exp-t2', 'exp-f2')
on conflict (provider, provider_team_id) do nothing;
-- An MLS match won on penalties: the export has to say so.
insert into public.games (id, sport_id, season, season_key, season_label, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, is_tie, decision_method, home_shootout_score, away_shootout_score, winner_team_id, provider, provider_game_id)
values ('00000000-0000-0000-0000-0000000000ec', 'mls', 2026, '2026', '2026', 'postseason', '2026-11-07T20:00:00Z',
        '00000000-0000-0000-0000-0000000000eb', '00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000ed',
        'final', 1, 1, false, 'shootout', 4, 3, '00000000-0000-0000-0000-0000000000ea', 'test', 'exp-g1')
on conflict (provider, provider_game_id) do nothing;
insert into public.players (id, sport_id, full_name, provider, provider_player_id)
values ('00000000-0000-0000-0000-0000000000ee', 'mls', 'Export Striker', 'test', 'exp-p1')
on conflict (provider, provider_player_id) do nothing;

insert into public.attendances (id, user_id, game_id, source)
values ('a1000000-0000-4000-8000-0000000000e3', 'a1000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-0000000000ec', 'manual'),
       ('a1000000-0000-4000-8000-0000000000e4', 'a1000000-0000-4000-8000-0000000000e2', '00000000-0000-0000-0000-0000000000ec', 'manual')
on conflict (id) do nothing;
insert into public.user_players (user_id, player_id) values ('a1000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-0000000000ee') on conflict do nothing;
insert into public.handshakes (game_id, from_user, to_user)
values ('00000000-0000-0000-0000-0000000000ec', 'a1000000-0000-4000-8000-0000000000e1', 'a1000000-0000-4000-8000-0000000000e2'),
       ('00000000-0000-0000-0000-0000000000ec', 'a1000000-0000-4000-8000-0000000000e2', 'a1000000-0000-4000-8000-0000000000e1')
on conflict do nothing;
insert into public.attendance_photos (id, attendance_id, user_id, storage_path, kind, visibility)
values ('a1000000-0000-4000-8000-0000000000e5', 'a1000000-0000-4000-8000-0000000000e3', 'a1000000-0000-4000-8000-0000000000e1', 'a1000000-0000-4000-8000-0000000000e1/exp.jpg', 'photo', 'private')
on conflict (id) do nothing;
insert into public.blocks (blocker_id, blocked_id) values ('a1000000-0000-4000-8000-0000000000e1', 'a1000000-0000-4000-8000-0000000000e2') on conflict do nothing;
insert into public.notifications (user_id, kind, title, body) values ('a1000000-0000-4000-8000-0000000000e1', 'test', 'Export', 'A notification');
insert into public.notification_prefs (user_id, prefs) values ('a1000000-0000-4000-8000-0000000000e1', '{"goal_completed": false}') on conflict (user_id) do update set prefs = excluded.prefs;
insert into public.device_tokens (user_id, token, platform) values ('a1000000-0000-4000-8000-0000000000e1', 'ExponentPushToken[export]', 'ios') on conflict do nothing;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000e1","role":"authenticated"}';

select is((select jsonb_array_length(export_my_data()->'players')), 1, 'favorite players are exported');
select is((select export_my_data()->'players'->0->>'name'), 'Export Striker', 'by name');
select is((select jsonb_array_length(export_my_data()->'handshakes')), 2, 'both halves of a handshake are exported');
select is((select bool_and((h->>'completed')::boolean) from jsonb_array_elements(export_my_data()->'handshakes') h), true, 'and both read as completed');
select is((select export_my_data()->'attendances'->0->'game'->>'decision_method'), 'shootout', 'an MLS match carries how it was decided');
select is((select export_my_data()->'attendances'->0->'game'->>'winner'), 'Export FC', 'and who won on penalties');
select is((select jsonb_array_length(export_my_data()->'attendances'->0->'photos')), 1, 'attendance photos are exported');
select is((select export_my_data()->'blocks'->0->>'handle'), 'exportthem', 'blocks are exported by handle');
select ok((select exists (select 1 from jsonb_array_elements(export_my_data()->'notifications') n where n->>'kind' = 'test')), 'notifications are exported');
select is((select export_my_data()->'notification_prefs'->'prefs'->>'goal_completed'), 'false', 'and their preferences');
select is((select export_my_data()->'device_tokens'->0->>'platform'), 'ios', 'device tokens are exported');
select is((select jsonb_array_length(export_my_data()->'attendances')), 1, 'only this user''s attendance, not the other fan''s at the same match');

select * from finish();
rollback;
