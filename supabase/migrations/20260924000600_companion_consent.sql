-- Social v2, prompt 1: tagging a companion becomes consent-based, for real users only
-- (docs/prompts/social/01, section 3; 00_repo_reality.md, ruling R5).
--
-- A companion is a `people` row, often just a name you typed ("Dad") with no account behind it.
-- Tagging one of those is a private label on your own attendance and keeps working exactly as
-- before: it is confirmed the moment it is made, with no consent step and no notification.
-- Only a person linked to a real account (`linked_user_id`) starts out pending, and only that
-- person can confirm or decline it. Prompt 2 builds the notify, accept and decline flow.
--
-- Every tag that exists today predates consent and stays confirmed.

alter table public.attendance_companions
  add column status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'declined')),
  add column confirmed_at timestamptz,
  add column invited_by uuid references public.profiles (id) on delete set null;

update public.attendance_companions ac
set invited_by = a.user_id,
    confirmed_at = coalesce(a.created_at, now())
from public.attendances a
where a.id = ac.attendance_id;

-- The status a new tag starts with comes from the person, never from the client: confirmed for
-- a placeholder, pending for a real user. `invited_by` is whoever owns the attendance.
create or replace function public.companions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linked uuid;
begin
  select linked_user_id into v_linked from public.people where id = new.person_id;
  select user_id into new.invited_by from public.attendances where id = new.attendance_id;
  if v_linked is null then
    new.status := 'confirmed';
    new.confirmed_at := now();
  else
    new.status := 'pending';
    new.confirmed_at := null;
  end if;
  return new;
end;
$$;

create trigger companions_before_insert before insert on public.attendance_companions
  for each row execute function public.companions_before_insert();

-- The tagged user answers. Nothing else about a tag changes after it is made, and a placeholder
-- tag has nobody to answer it.
create or replace function public.companions_before_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.attendance_id := old.attendance_id;
    new.person_id := old.person_id;
    new.invited_by := old.invited_by;
    if new.status = 'pending' and old.status <> 'pending' then
      raise exception 'a tag cannot go back to pending' using errcode = 'check_violation';
    end if;
  end if;
  new.confirmed_at := case when new.status = 'confirmed' then coalesce(old.confirmed_at, now()) else null end;
  return new;
end;
$$;

create trigger companions_before_update before update on public.attendance_companions
  for each row execute function public.companions_before_update();

create policy attendance_companions_update on public.attendance_companions for update to authenticated
  using (exists (
    select 1 from public.people p where p.id = attendance_companions.person_id and p.linked_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.people p where p.id = attendance_companions.person_id and p.linked_user_id = auth.uid()
  ));
