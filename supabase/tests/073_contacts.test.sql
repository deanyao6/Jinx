-- Contacts matching (migration 20260924010200; social brief 02, section 5): the normalizers
-- agree with packages/core/src/contacts.ts, a match needs only the hash, the call stores
-- nothing, opting out and blocks hide you, and the seven-follow goal is stamped once.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- The same examples as contacts.test.ts.
select is(public.contact_normalize_email('  Maya.Chen@Example.COM '), 'maya.chen@example.com', 'email: trimmed and lowercased');
select is(public.contact_normalize_email('a@b'), null, 'email: not an email');
select is(public.contact_normalize_phone('(215) 555-0134'), '12155550134', 'phone: ten digits gain the country code');
select is(public.contact_normalize_phone('+44 20 7946 0958'), '442079460958', 'phone: international kept as digits');
select is(public.contact_normalize_phone('911'), null, 'phone: too short');

insert into auth.users (id, email, phone) values
  ('b7300000-0000-4000-8000-0000000000a1', 'ct-me@test.com', null),
  ('b7300000-0000-4000-8000-0000000000b1', 'Maya.Chen@Example.com', '2155550134'),
  ('b7300000-0000-4000-8000-0000000000b2', 'hidden@example.com', null),
  ('b7300000-0000-4000-8000-0000000000b3', 'blocked@example.com', null),
  ('b7300000-0000-4000-8000-0000000000b4', 'x@privaterelay.appleid.com', null);
update public.profiles set onboarded_at = now() where id::text like 'b7300000%';
update public.profiles set discoverable_by_contacts = false where id = 'b7300000-0000-4000-8000-0000000000b2';
insert into public.blocks (blocker_id, blocked_id) values ('b7300000-0000-4000-8000-0000000000b3', 'b7300000-0000-4000-8000-0000000000a1');
-- The hash a phone would compute. The trigger hashes accounts as they are created.
update auth.users set phone = '2155550134' where id = 'b7300000-0000-4000-8000-0000000000b1';

select is((select count(*)::integer from public.contact_identifiers where user_id = 'b7300000-0000-4000-8000-0000000000b4'), 0,
  'an Apple relay address is not hashed: no address book holds one');

create temp table sent as
select array[
  public.contact_hash('email', 'maya.chen@example.com'),
  public.contact_hash('email', 'hidden@example.com'),
  public.contact_hash('email', 'blocked@example.com'),
  public.contact_hash('email', 'ct-me@test.com'),
  public.contact_hash('email', 'nobody@example.com')
] as hashes;
grant select on sent to authenticated;
create temp table before as
select (select count(*) from public.contact_identifiers) as ids, (select count(*) from public.rate_events) as events;

set local role authenticated;
set local request.jwt.claims to '{"sub":"b7300000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select length(public.contact_salt())), 48, 'a signed-in fan gets the salt');
select results_eq(
  $$select user_id from public.match_contacts((select hashes from sent))$$,
  $$values ('b7300000-0000-4000-8000-0000000000b1'::uuid)$$,
  'only the discoverable, unblocked match comes back; not me, not someone who opted out, not a blocker');
select is((select count(*)::integer from public.contact_identifiers), 0, 'nobody reads the hashed identifiers directly');
reset role;
select is((select count(*) from public.contact_identifiers), (select ids from before),
  'matching stored no hashes');
select is((select count(*) from public.rate_events) - (select events from before), 1::bigint,
  'the only row written is the rate-limit tick');

-- ---- Seven follows ----
insert into auth.users (id, email)
select ('b7300000-0000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'ct-f' || i || '@test' from generate_series(1, 7) i;
insert into public.follows (follower_id, followee_id)
select 'b7300000-0000-4000-8000-0000000000a1', ('b7300000-0000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 6) i;
select is((select seven_follows_at from public.profiles where id = 'b7300000-0000-4000-8000-0000000000a1'), null, 'six follows are not the goal');
insert into public.follows (follower_id, followee_id) values ('b7300000-0000-4000-8000-0000000000a1', 'b7300000-0000-4000-8000-000000000107');
select isnt((select seven_follows_at from public.profiles where id = 'b7300000-0000-4000-8000-0000000000a1'), null, 'the seventh is');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b7300000-0000-4000-8000-0000000000a1","role":"authenticated"}';
update public.profiles set seven_follows_at = null where id = 'b7300000-0000-4000-8000-0000000000a1';
reset role;
select isnt((select seven_follows_at from public.profiles where id = 'b7300000-0000-4000-8000-0000000000a1'), null,
  'a fan cannot reset their own metric');

select * from finish();
rollback;
