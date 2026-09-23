-- Make someone a creator (a superfan shown in Discover), or stop. Social brief 02, section 4.
-- There is no self-serve application: Dean decides, and runs this with the service role.
--
--   psql "$DB_URL" -v handle=phillyphan -v note='Phillies since 1996, 118 games logged' -f supabase/scripts/creator.sql
--   psql "$DB_URL" -v handle=phillyphan -v note= -v off=1 -f supabase/scripts/creator.sql
--
-- The note is one line, at most 280 characters, shown under their name. Discover's ranking is
-- rebuilt daily at 10:15 UTC; the last statement rebuilds it now so the change shows at once.

\set ON_ERROR_STOP on
\if :{?off}
  update public.profiles set is_creator = false, creator_note = null where handle = lower(:'handle');
\else
  update public.profiles set is_creator = true, creator_note = nullif(:'note', '') where handle = lower(:'handle');
\endif
select handle, is_creator, creator_note, followers_count from public.profiles where handle = lower(:'handle');
select public.refresh_creator_rankings() as creator_rows;
