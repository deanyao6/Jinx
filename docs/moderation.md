# Moderation policy

Jinx has user-generated content in handles, display names, placeholder companion names, notes,
posts (captions and photos), comments and reaction photos. This is how it is handled (App Store
Guideline 1.2: a way to filter objectionable material, a way to report it, a way to block
abusive users, and a response within 24 hours).

## Filtering

- **Handles and display names** pass a profanity filter, in the app before saving and in the
  database on every write (`contains_profanity`, migration `20260924010500`). One list serves
  both: `packages/core/src/profanity.ts`, and a test fails if the SQL copy drifts from it. A
  refused name gets error code `JX451`, which the app turns into "That name will not work here."
  The database also rejects handles outside `[a-z0-9_]{3,20}`.
- **Comments** get a soft warning, not a silent block: a comment with a listed word asks "Post
  this? It might come across badly" and the fan can edit it or post anyway. Comments are at most
  500 characters.

## Reporting

- The overflow menu (the three dots) on every **post, comment, reaction and profile** offers
  Report, Mute and Block. Attendances, feed events, companions and attendance photos can be
  reported as before, and communities from prompt 4.
- A report lands in `public.reports` with the reporter, the target type and id, and a reason
  picked from a short list.

## Blocking and muting

- **Block** removes follows in both directions and hides both people from each other
  everywhere: profiles, the feed, posts, kudos (including the counts), comments, reactions,
  Discover, contacts matches, compatibility, overlap, rivalries, tags, and community feeds and
  leaderboards. A tag from someone blocked is dropped when it is made.
- **Mute** (`public.mutes`) hides someone's posts from your feed and their comments from your
  threads, without telling them or unfollowing. Their post still opens from a direct link.

## Rate limits

Enforced in the database (`rate_limit_trigger`, migration `20260924010100`), per signed-in user.
Hitting one returns error code `JX429`, which the app shows as a sentence, never a crash.

| Action | Limit |
|---|---|
| Posts | 20 an hour |
| Comments | 20 in 10 minutes |
| Kudos | 120 an hour |
| Follows | 150 an hour |
| Reports | 10 an hour |
| Contact matching | 5 calls an hour, 2,000 contacts a call |

## Review process

1. **Look at the queue once a day, and within 24 hours of any report.** With the service role:
   `select * from public.report_queue;` It lists open reports, oldest first, with how many
   times the same thing was reported and a snapshot of it (the post's caption, the comment's
   body, the reaction's photo paths, the profile's names). Fans cannot read it.
2. **Decide.** Remove it if it breaks the terms (harassment, hate, sexual content, spam,
   impersonation, someone else's private information). Warn for a first, mild case. Suspend or
   ban for repeated or severe abuse.
3. **Act, with the service role:**
   - A post: `update posts set deleted_at = now() where id = ...` (it disappears for everyone
     but its author), or delete the row to remove it outright.
   - A comment: `delete from comments where id = ...`.
   - A reaction or a photo: delete the row and its object in storage.
   - A name: rename the handle or display name to something neutral.
   - A ban: delete the account (`delete-account` Edge Function, or `auth.admin.deleteUser`).
4. **Record it** on the report: `update reports set resolved_at = now(), action = 'removed',
   resolution = '...' where id = ...`. `action` is one of `none`, `removed`, `warned`,
   `suspended`, `banned`. Resolve every report on the same target together.

## Contact and age

- **Contact**: the support email is listed on the About screen and in the App Store listing.
  (`support@example.com` is still a placeholder in the app; Dean supplies the real address.)
- **Age**: sign-up requires a birth date of 13 or older; under-13 dates are rejected by the
  database.
