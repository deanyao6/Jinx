-- Social v2, prompt 1 (docs/prompts/social/00_repo_reality.md, ruling R2).
--
-- `reactions` has meant emoji on feed events since the first user-data migration. The social
-- briefs, the prototype and the product language all use "reaction" for the BeReal-style photo
-- captured at a game, which migration 20260924000500 creates under that name. So the emoji
-- table becomes `feed_reactions`, here, before any later prompt can see the old name.
--
-- A rename keeps the rows, the primary key, the foreign keys and the policies (they follow the
-- table). Constraint and policy names are renamed too so nothing still says `reactions_`.
--
-- Two functions read the table by name in their bodies, which a rename does not rewrite:
-- `feed()` and `export_my_data()`. Left alone they would read the new photo table once it
-- exists. Each is rewritten from its own current definition with the one table name changed,
-- and the rewrite refuses to run if the text it expects is not there, rather than guess.

alter table public.reactions rename to feed_reactions;
alter table public.feed_reactions rename constraint reactions_pkey to feed_reactions_pkey;
alter table public.feed_reactions rename constraint reactions_emoji_check to feed_reactions_emoji_check;
alter table public.feed_reactions rename constraint reactions_feed_event_id_fkey to feed_reactions_feed_event_id_fkey;
alter table public.feed_reactions rename constraint reactions_user_id_fkey to feed_reactions_user_id_fkey;
alter policy reactions_select on public.feed_reactions rename to feed_reactions_select;
alter policy reactions_write on public.feed_reactions rename to feed_reactions_write;

comment on table public.feed_reactions is
  'Emoji reactions on feed events (SPEC 6.16). Was `reactions` until 20260924000100; that name now belongs to reaction photos.';

do $$
declare
  v_def text;
  v_new text;
begin
  -- feed(): two subqueries count and read the viewer's emoji.
  select pg_get_functiondef('public.feed'::regproc) into v_def;
  v_new := replace(v_def, 'from public.reactions ', 'from public.feed_reactions ');
  if (length(v_def) - length(replace(v_def, 'from public.reactions ', ''))) / length('from public.reactions ') <> 2 then
    raise exception 'feed(): expected two reads of public.reactions';
  end if;
  execute v_new;

  -- export_my_data(): the fan's emoji go out under a key that says what they are, and the
  -- key `reactions` is kept for the reaction photos (added in 20260924000500).
  select pg_get_functiondef('public.export_my_data'::regproc) into v_def;
  if position($f$'reactions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.reactions r where r.user_id = auth.uid())$f$ in v_def) = 0 then
    raise exception 'export_my_data(): the reactions entry is not where it was expected';
  end if;
  v_new := replace(
    v_def,
    $f$'reactions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.reactions r where r.user_id = auth.uid())$f$,
    $f$'feed_reactions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.feed_reactions r where r.user_id = auth.uid())$f$
  );
  execute v_new;
end;
$$;
