-- Badge posts can be switched off like every other automatic post (social brief 02, section 1).
-- Prompt 4 added the 'badge' post kind (20260924030300); the list of kinds a fan may mute, from
-- 20260924010000, did not know it, so a fan could not turn badge posts off.

alter table public.profiles drop constraint profiles_muted_post_kinds_check;
alter table public.profiles add constraint profiles_muted_post_kinds_check
  check (muted_post_kinds <@ array['stamp', 'milestone', 'goal', 'wrapped', 'badge']::text[]);
