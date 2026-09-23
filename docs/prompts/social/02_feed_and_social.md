# Prompt 2: the Feed tab, kudos, comments, and the social graph

> **Read [`00_repo_reality.md`](00_repo_reality.md) first.** It lists every place this brief
> disagrees with the repo as it stands, and how to resolve each one. Where the two conflict,
> `00_repo_reality.md` wins unless Dean says otherwise.

Depends on prompt 1. Read `design/prototype.html` and click: Feed, both segments, a post, comments, a profile, and the "First launch" button.

## 1. What a post is

Posts are created three ways:

1. **Game posts.** When an attendance for a final game exists and the user's auto-post setting is on, a post is created 30 minutes after the game goes final, with a 15-minute "edit before it posts" window shown as a banner in Games. If auto-post is off, the game sits in Games with a "Post this" button.
2. **Reaction posts.** Created immediately when a reaction is posted (prompt 3). Separate object, separate post kind.
3. **System posts.** Stamp earned, milestone (10th, 25th, 50th, 100th game), goal completed, Wrapped published. These are auto-generated, and each type can be muted in settings.

A game post can **attach** reactions from that game: the composer lists the user's reactions from that attendance with checkboxes. Attaching sets `reactions.post_id`; the reaction post stays where it is. Nothing is duplicated in the feed.

**Composer** (opened from Games or from the auto-post edit banner): caption, photos, which reactions to attach, visibility, and companion tags. Keep it to one screen.

## 2. Feed ranking

Reverse chronological within each segment. No algorithmic feed. This is deliberate: Strava's feed works because you see the people you actually know.

- **Following:** posts from users you follow plus your own, minus muted and blocked, minus posts whose visibility excludes you.
- **Discover:** trip mode card when active, then creators you don't follow who post about your teams, then "fans at your games" (users who logged a game you also logged, mutuals excluded since they're already in Following), then community posts from communities you've joined.
- Following and Discover are a **toggle at the top of the feed**, in the style of a For You versus Friends switch. Switching segments must not add a navigation entry, so there is never a back arrow between them.
- Page by `created_at` with a cursor. Pull to refresh. Empty state in Following prompts: follow people, import contacts, or join a community, with a button for each.

## 3. Kudos and comments

- **Kudos:** one tap, optimistic UI, undo by tapping again, rate-limited server-side. No kudos on your own posts (hide the button). Notification to the author, batched: "Maya and 3 others gave kudos."
- **Comments:** flat list, no threads, 500-character limit, newest last. Author of the post and author of the comment can delete. Every comment has an overflow menu with report, block, and mute. Profanity filter on submit with a soft warning, not a silent block.
- Both respect blocks in both directions, everywhere, including counts.

## 4. Creators and Discover

- `profiles.is_creator` marks superfan accounts, set manually by us for now (a SQL script plus an admin note in the README). No self-serve application yet.
- Creator profiles show a badge, a follower count, and an optional one-line note ("Phillies since 1996, 118 games logged").
- Discover ranks creators by: shares a favorite team with the viewer, then by follower count, then by recency of posting. Cap at 10, refresh daily.
- Creators are one-way follows like everyone else. No DMs, no verification requests, no paid promotion.

## 5. Contacts import

Ask **after** Sign in with Apple as the second onboarding step, exactly as the prototype's First launch screen shows, with the value proposition on screen before the system prompt fires.

- Hash contact phone numbers and emails client-side with a server-provided salt, send only hashes, match against hashed identifiers, return matches, then discard. Never store raw contacts. Document this in the privacy policy and the App Privacy answers.
- Show matches with a "Follow all" and per-row follow. Non-matches become invite rows that open the system share sheet with a link.
- Skippable, and re-offerable later from Profile → Friends.
- The onboarding success metric is **7 follows**, not one logged game. Instrument it.

## 6. Compatibility and "with" records

- **Compatibility** between two mutual follows: a 0 to 100 score from overlapping favorite teams, overlapping venues visited, overlapping games attended, and similar neutral-pick behavior. Show it as a single number with a one-line explanation of the biggest driver ("you have 6 stadiums in common"). Compute server-side, cache daily, mutuals only.
- **Record with** each person (existing companion record) appears on their profile and in Friends.
- Rivalry and overlap cards stay as specified in `SPEC.md` 6.11 and 6.12: mutuals only.

## 7. Companion tagging becomes consent-based

- Tagging creates `attendance_companions` with `status='pending'` and notifies the tagged user: "Dean says you were at Phillies vs Mets, Sep 20. Add it?"
- Accept creates an attendance for them (source `manual`, unverified, their own visibility default) and posts to their feed only if their auto-post is on.
- Decline removes the tag silently, without telling the tagger who declined, and blocks re-tagging by that user for that game.
- Pending tags never appear in the tagged user's feed, profile, records, or leaderboards.
- Tags from blocked users are dropped at creation.

## 8. Moderation, required for App Review

Report, block, and mute on posts, comments, reactions, and profiles. A reports queue table plus a documented review process in `docs/MODERATION.md`. Blocked users cannot see each other anywhere, including community feeds and leaderboards. Rate limits on posts, comments, kudos, follows, and reports. Handles and display names pass a profanity filter.

## 9. Acceptance

- Post visibility matrix has RLS tests: public, followers, private, blocked in both directions, muted (muting hides from feed, not from the post's own page).
- Auto-post fires once per attendance, never twice, and respects the edit window; toggling auto-post off mid-window cancels it.
- Attaching a reaction to a game post does not create a second feed entry.
- Contacts flow: verify that no raw contact data hits the network (inspect the request payloads in a test).
- Feed pagination is stable when new posts arrive mid-scroll.
- Rate limits return a friendly error, not a crash.
- Show me a demo-mode feed with each post kind rendered, in light and dark.
