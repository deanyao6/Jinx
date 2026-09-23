-- Moderation (migration 20260924010500; social brief 02, section 8): profane handles and names
-- are refused with a code the app understands, fans can report every kind of content, the
-- queue is the service role's alone, and reports are rate limited.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('b7600000-0000-4000-8000-0000000000a1', 'md-me@test'),
  ('b7600000-0000-4000-8000-0000000000b1', 'md-other@test');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b7600000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok($$update public.profiles set handle = 'fuckyou99' where id = auth.uid()$$,
  'JX451', 'profane_name: handle', 'a profane handle is refused');
select throws_ok($$update public.profiles set display_name = 'Sh1t Head' where id = auth.uid()$$,
  'JX451', 'profane_name: display_name', 'so is a display name, swaps and all');
select lives_ok($$update public.profiles set handle = 'phillies_phan', display_name = 'Bass Cassidy' where id = auth.uid()$$,
  'ordinary names pass');

select lives_ok($$insert into public.reports (reporter_id, target_type, target_id, reason) values
  (auth.uid(), 'post', gen_random_uuid(), 'spam'),
  (auth.uid(), 'comment', gen_random_uuid(), 'abuse'),
  (auth.uid(), 'reaction', gen_random_uuid(), 'nudity'),
  (auth.uid(), 'user', 'b7600000-0000-4000-8000-0000000000b1', 'impersonation')$$,
  'posts, comments, reactions and profiles can all be reported');
select throws_ok($$select * from public.report_queue$$, '42501', null, 'the queue is not a fan''s to read');
select throws_ok(
  $q$do $d$ begin for i in 1..7 loop
    insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'post', gen_random_uuid(), 'spam');
  end loop; end $d$$q$,
  'JX429', 'rate_limited: report', 'the eleventh report in an hour is refused');
reset role;

select is((select count(*)::integer from public.report_queue where reporter_id = 'b7600000-0000-4000-8000-0000000000a1'), 4,
  'the service role sees the open reports');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b7600000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select ok(public.export_my_data() ? 'companion_declines', 'the export carries declines');
reset role;

select * from finish();
rollback;
