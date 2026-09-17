-- Reports: a fan photo can be reported, and a report is visible to nobody but its author
-- (SPEC.md 6.19, 11). The reports policies had no test of their own before this.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-00000000f0a1', 'reporter@example.com'),
  ('a1000000-0000-4000-8000-00000000f0a2', 'other@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-00000000f0a1","role":"authenticated"}';

select lives_ok($$insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('a1000000-0000-4000-8000-00000000f0a1', 'attendance_photo', gen_random_uuid(), 'Inappropriate name or content')$$,
  'a fan photo can be reported');

select throws_ok($$insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('a1000000-0000-4000-8000-00000000f0a1', 'storage_object', gen_random_uuid(), 'x')$$,
  '23514', null, 'an unknown target type is still refused');

select throws_ok($$insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('a1000000-0000-4000-8000-00000000f0a2', 'attendance_photo', gen_random_uuid(), 'x')$$,
  '42501', null, 'nobody can file a report in someone else''s name');

select is((select count(*)::int from public.reports), 1, 'the reporter sees their own report');

set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-00000000f0a2","role":"authenticated"}';
select is((select count(*)::int from public.reports), 0, 'another user sees no reports at all');

reset role;
select is((select count(*)::int from public.reports where target_type = 'attendance_photo'), 1,
  'the report is stored for moderation');

select * from finish();
rollback;
