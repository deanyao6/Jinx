-- Social v2, prompt 2, section 5: finding people you know from your contacts, and the
-- onboarding goal of seven follows (docs/prompts/social/02).
--
-- How contacts are matched, and what is kept (docs/privacy.md says the same in plain words):
--   1. The app asks the server for a salt (`contact_salt()`).
--   2. On the phone, each contact's emails and phone numbers are normalized
--      (packages/core/src/contacts.ts) and hashed: sha256(salt ':' kind ':' value), hex.
--   3. Only the hashes are sent, to `match_contacts()`, which compares them with the same hash
--      of every account's sign-in email and phone, returns the matches, and keeps nothing: the
--      hashes live in the function's arguments and nowhere else. No raw contact ever leaves the
--      phone, and no contact, raw or hashed, is stored.
--
-- The salt is handed to every signed-in client, so it is not a secret. What it buys is that a
-- hash taken from Jinx is useless against any other service's list. A phone number has few
-- enough possible values that no hash hides it from someone who holds the salt and tries them
-- all, which is why the server keeps no hashes of anyone's contacts at all.

-- ---------------------------------------------------------------------------
-- The salt
-- ---------------------------------------------------------------------------

create table public.contact_match_salt (
  id integer primary key default 1 check (id = 1),
  salt text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);
alter table public.contact_match_salt enable row level security;
insert into public.contact_match_salt default values;

create or replace function public.contact_salt()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select salt from public.contact_match_salt where id = 1 and auth.uid() is not null;
$$;

revoke all on function public.contact_salt() from public, anon;
grant execute on function public.contact_salt() to authenticated;

-- ---------------------------------------------------------------------------
-- Normalizing and hashing: the SQL twin of packages/core/src/contacts.ts. Both are tested on
-- the same examples (pgTAP 073 and contacts.test.ts), so they cannot drift apart unseen.
-- ---------------------------------------------------------------------------

create or replace function public.contact_normalize_email(p text)
returns text
language sql
immutable
as $$
  select case when p is null then null
              when lower(btrim(p)) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(btrim(p)) end;
$$;

-- Digits only; a 10-digit number is North American and gains its country code. Fewer than 7
-- digits is not a phone number.
create or replace function public.contact_normalize_phone(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) = 10 then '1' || regexp_replace(p, '\D', '', 'g')
    when length(regexp_replace(p, '\D', '', 'g')) >= 7 then regexp_replace(p, '\D', '', 'g')
  end;
$$;

create or replace function public.contact_hash(p_kind text, p_value text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select encode(extensions.digest((select salt from public.contact_match_salt where id = 1) || ':' || p_kind || ':' || p_value, 'sha256'), 'hex');
$$;

revoke all on function public.contact_hash(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Each account's own identifiers, hashed. Nobody reads this table but match_contacts().
-- ---------------------------------------------------------------------------

create table public.contact_identifiers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('email', 'phone')),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  primary key (user_id, kind, hash)
);
create index contact_identifiers_hash_idx on public.contact_identifiers (hash);
alter table public.contact_identifiers enable row level security;

-- Whether people who have your email or number can find you. On by default, like every
-- contacts-based app; the switch is in Privacy.
alter table public.profiles
  add column discoverable_by_contacts boolean not null default true,
  -- The onboarding goal (brief 02, section 5): the moment this fan first followed seven people.
  add column seven_follows_at timestamptz,
  -- When the fan answered the contacts step (allowed or skipped), so it is offered once.
  add column contacts_prompted_at timestamptz;

create or replace function public.refresh_contact_identifiers(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_phone text;
begin
  delete from public.contact_identifiers where user_id = p_user;
  if not exists (select 1 from public.profiles where id = p_user) then return; end if;
  select public.contact_normalize_email(email), public.contact_normalize_phone(phone)
    into v_email, v_phone from auth.users where id = p_user;
  -- Apple's relay addresses are unique to Jinx; no contact list holds one.
  if v_email is not null and v_email not like '%@privaterelay.appleid.com' then
    insert into public.contact_identifiers values (p_user, 'email', public.contact_hash('email', v_email));
  end if;
  if v_phone is not null then
    insert into public.contact_identifiers values (p_user, 'phone', public.contact_hash('phone', v_phone));
  end if;
end;
$$;

revoke all on function public.refresh_contact_identifiers(uuid) from public, anon, authenticated;

create or replace function public.auth_users_contact_identifiers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_contact_identifiers(new.id);
  return null;
end;
$$;

create trigger auth_users_contact_identifiers after update of email, phone on auth.users
  for each row execute function public.auth_users_contact_identifiers();

-- The profile row arrives after the auth user, so a new account is hashed when its profile is.
create or replace function public.profiles_contact_identifiers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_contact_identifiers(new.id);
  return null;
end;
$$;

create trigger profiles_contact_identifiers after insert on public.profiles
  for each row execute function public.profiles_contact_identifiers();

do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.refresh_contact_identifiers(r.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Matching
-- ---------------------------------------------------------------------------

-- Hashes in, people out. Five calls an hour, 2,000 hashes a call. Nothing is written but the
-- rate-limit row: not the hashes, not the matches.
create or replace function public.match_contacts(p_hashes text[])
returns table (
  hash text,
  user_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  is_private boolean,
  follow_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if coalesce(array_length(p_hashes, 1), 0) > 2000 then
    raise exception 'too many contacts in one call' using errcode = 'invalid_parameter_value';
  end if;
  perform public.rate_limit('contact_match', 5, interval '1 hour');
  return query
    select distinct on (pr.id) ci.hash, pr.id, pr.handle, pr.display_name, pr.avatar_path, pr.is_private,
           (select f.status from public.follows f where f.follower_id = auth.uid() and f.followee_id = pr.id)
    from public.contact_identifiers ci
    join public.profiles pr on pr.id = ci.user_id
    where ci.hash = any (p_hashes)
      and pr.id <> auth.uid()
      and pr.discoverable_by_contacts
      and pr.onboarded_at is not null
      and not public.is_blocked_between(auth.uid(), pr.id)
    order by pr.id, ci.kind;
end;
$$;

revoke all on function public.match_contacts(text[]) from public, anon;
grant execute on function public.match_contacts(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Seven follows: the onboarding success metric, stamped once.
-- ---------------------------------------------------------------------------

create or replace function public.follows_seven()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set seven_follows_at = now()
  where id = new.follower_id and seven_follows_at is null and following_count >= 7;
  return null;
end;
$$;

-- Named to sort after follows_count, which moves following_count first.
create trigger follows_zz_seven after insert or update of status on public.follows
  for each row when (new.status = 'active') execute function public.follows_seven();

update public.profiles set seven_follows_at = now() where following_count >= 7 and seven_follows_at is null;

-- The number itself, for Dean: of the fans who signed up in a week, how many followed seven
-- people within seven days of signing up. Service role only.
create or replace view public.onboarding_follow_goal as
select date_trunc('week', created_at)::date as week,
       count(*) as signed_up,
       count(*) filter (where seven_follows_at <= created_at + interval '7 days') as reached_seven,
       count(*) filter (where contacts_prompted_at is not null) as answered_contacts
from public.profiles
group by 1
order by 1 desc;

revoke all on public.onboarding_follow_goal from public, anon, authenticated;

-- The server's columns stay the server's: redefined from 20260924000300 with the metric added.
create or replace function public.profiles_keep_server_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_creator := old.is_creator;
    new.creator_note := old.creator_note;
    new.followers_count := old.followers_count;
    new.following_count := old.following_count;
    new.posts_backfilled_at := old.posts_backfilled_at;
    new.seven_follows_at := old.seven_follows_at;
  end if;
  return new;
end;
$$;
