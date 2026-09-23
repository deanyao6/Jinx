-- Social v2, prompt 2, section 8: moderation for App Review (docs/prompts/social/02;
-- the process is docs/moderation.md).
--
-- Already in place: report (reports, widened to posts, comments and reactions in
-- 20260924000300), block (blocks, both directions everywhere), mute (mutes), and rate limits on
-- posts, comments, kudos, follows and reports (20260924010100). This adds the name filter and
-- the report queue view, and carries declines in the data export.

-- ---------------------------------------------------------------------------
-- Handles and display names pass a profanity filter. The lists are packages/core/src/profanity.ts
-- word for word; profanity.test.ts reads this file and fails if they differ.
-- ---------------------------------------------------------------------------

create or replace function public.contains_profanity(p_text text)
returns boolean
language sql
immutable
as $$
  with swapped as (
    select translate(lower(coalesce(p_text, '')), '013457@$!', 'oieastasi') as t
  )
  select exists (
    select 1 from swapped, regexp_split_to_table(swapped.t, '[^a-z]+') as w
    where w = any (
      -- profane words
      array['asshole', 'assholes', 'bastard', 'bastards', 'bitch', 'bitches', 'bitchy', 'bullshit',
  'chink', 'chinks', 'cock', 'cocks', 'cocksucker', 'cunt', 'cunts', 'dick', 'dickhead',
  'dicks', 'fag', 'faggot', 'faggots', 'fags', 'fuck', 'fucked', 'fucker', 'fuckers',
  'fucking', 'fucks', 'kike', 'kikes', 'motherfucker', 'motherfuckers', 'motherfucking',
  'nigga', 'niggas', 'nigger', 'niggers', 'pussy', 'retard', 'retarded', 'retards', 'shit',
  'shits', 'shitty', 'slut', 'sluts', 'spic', 'spics', 'twat', 'twats', 'wank', 'wanker',
  'whore', 'whores']
    )
  ) or exists (
    select 1 from swapped, unnest(
      -- profane fragments
      array['cunt', 'fag', 'fuck', 'kike', 'motherf', 'nigga', 'nigger', 'retard', 'shit', 'slut', 'whore']
    ) as f
    where position(f in regexp_replace(swapped.t, '[^a-z]', '', 'g')) > 0
  );
$$;

create or replace function public.profiles_clean_names()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' or new.handle is distinct from old.handle) and public.contains_profanity(new.handle) then
    raise exception 'profane_name: handle' using errcode = 'JX451', hint = 'Pick a different handle.';
  end if;
  if (tg_op = 'INSERT' or new.display_name is distinct from old.display_name) and public.contains_profanity(new.display_name) then
    raise exception 'profane_name: display_name' using errcode = 'JX451', hint = 'Pick a different name.';
  end if;
  return new;
end;
$$;

create trigger profiles_clean_names before insert or update of handle, display_name on public.profiles
  for each row execute function public.profiles_clean_names();

-- ---------------------------------------------------------------------------
-- The report queue, for whoever reviews it with the service role (docs/moderation.md).
-- Open reports first, oldest first, with what was reported and how often.
-- ---------------------------------------------------------------------------

create or replace view public.report_queue as
select r.id, r.created_at, r.target_type, r.target_id, r.reason, r.reporter_id,
       (select count(*) from public.reports x where x.target_type = r.target_type and x.target_id = r.target_id) as times_reported,
       case r.target_type
         when 'post' then (select jsonb_build_object('author_id', p.author_id, 'kind', p.kind, 'caption', p.caption, 'deleted', p.deleted_at is not null) from public.posts p where p.id = r.target_id)
         when 'comment' then (select jsonb_build_object('author_id', c.author_id, 'post_id', c.post_id, 'body', c.body, 'deleted', c.deleted_at is not null) from public.comments c where c.id = r.target_id)
         when 'reaction' then (select jsonb_build_object('author_id', x.user_id, 'back_path', x.back_path, 'front_path', x.front_path) from public.reactions x where x.id = r.target_id)
         when 'user' then (select jsonb_build_object('handle', p.handle, 'display_name', p.display_name) from public.profiles p where p.id = r.target_id)
       end as target
from public.reports r
where r.resolved_at is null
order by r.created_at;

revoke all on public.report_queue from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The data export carries the declines a fan made.
-- ---------------------------------------------------------------------------

do $$
declare
  v_def text;
  v_anchor text := $f$'mutes', (select$f$;
begin
  select pg_get_functiondef('public.export_my_data'::regproc) into v_def;
  if position(v_anchor in v_def) = 0 then
    raise exception 'export_my_data(): the mutes entry from prompt 1 is missing';
  end if;
  execute replace(v_def, v_anchor, $f$'companion_declines', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.companion_declines d where d.user_id = auth.uid()),
    $f$ || v_anchor);
end;
$$;
