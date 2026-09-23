# Prompt 1: five-tab restructure and the v2 schema

> **Read [`00_repo_reality.md`](00_repo_reality.md) first.** It lists every place this brief
> disagrees with the repo as it stands, and how to resolve each one. Where the two conflict,
> `00_repo_reality.md` wins unless Dean says otherwise.

Read `SPEC.md`, `design/reference.html`, and `design/prototype.html` (open the prototype in a browser and click through every screen, including the right-hand wiring panel, which states what each screen links to and why).

This prompt restructures navigation and lands the entire data model for the social features. It ships **no** feed, reactions, or community UI; those come in prompts 2 through 5. The goal is that the skeleton, routes, and tables are right before features land on top.

## 1. Tab structure

Replace the four-tab bar with five: **Feed, Passport, Games, Plan, Profile**, in that order, Feed leftmost.

- Plan ships as an honest **coming soon** screen: one line on what it will do (tailgates, parking, gates, post-game spots) and a feedback email address. No fake itinerary, no demo shell. Keep the routes alive behind `FEATURE_PLAN` for when it lands.
- Each tab owns a navigation stack. Switching tabs preserves each stack; tapping the active tab pops to that tab's root.
- Screen-to-tab mapping (from the prototype):
  - Feed: feed, comments, communities, community, leaderboard, trip, other users' profiles
  - Passport: passport, record log, stamps, badges, four favorites, recaps
  - Games: games (Upcoming, History, Imports, in that order), log flow, game detail, relive, the checked-in session screen, pick a side
  - Plan: game day plan
  - Profile: profile (counts, four favorites, recent games) and settings. Friends, communities, badges, recaps and four-favorites editing all live **inside settings**, reached by the gear in the top right, not as a list on the profile itself

## 2. Routing and deep links

Use expo-router with a typed route map. Every screen must be reachable by URL so push notifications, share links, and the parity harness can jump straight in:

```
/feed?tab=following|discover (a segment, not a route push), /post/[postId], /post/[postId]/comments
/user/[handle]
/game/[gameId]           (a game, plus the viewer's or owner's context)
/game/[gameId]/relive?owner=[handle]
/game/[gameId]/checkin (the live session screen), /game/[gameId]/pick
/passport, /passport/record/[key], /passport/streak/[teamId], /passport/stamps, /passport/badges, /passport/favorites
/games, /games/log, /games/imports
/communities, /community/[slug], /community/[slug]/leaderboard?stat=&period=
/plan/[gameId]
/profile, /profile/settings, /profile/settings/friends, /recaps/[sport]/[season]
/react/[gameId]?prompt=[promptId]
```

Segmented controls (Feed's Following/Discover, Games' Upcoming/History/Imports) change a query param in place and never push a history entry, so a back arrow never appears between segments.

Rules: a deep link into a tab pushes onto that tab's stack with a synthetic back entry to the tab root, so back never dead-ends. Unknown or unauthorized links land on the tab root with a toast, never a crash.

## 3. Schema

All tables RLS-enabled. Write migrations as plain SQL with a test per policy.

```sql
-- social graph (follows already exist; extend)
follows(follower_id, followee_id, created_at, status)          -- existing
profiles: add is_creator bool default false, creator_note text,
          followers_count int default 0, following_count int default 0

-- posts: the feed's unit. A post points at exactly one subject.
posts(id uuid pk, author_id uuid, kind text,                   -- 'game' | 'reaction' | 'stamp' | 'milestone' | 'goal' | 'wrapped'
      attendance_id uuid null, reaction_id uuid null, game_id uuid null,
      caption text null, visibility text,                      -- 'followers' | 'public' | 'private'
      auto_posted bool default false, created_at timestamptz,
      kudos_count int default 0, comment_count int default 0, deleted_at timestamptz null)
post_photos(id uuid pk, post_id uuid, storage_path text, ordinal int)
kudos(post_id uuid, user_id uuid, created_at, primary key(post_id, user_id))
comments(id uuid pk, post_id uuid, author_id uuid, body text, created_at,
         deleted_at timestamptz null)

-- check-in sessions (a session, not a moment)
checkin_sessions(id uuid pk, user_id uuid, game_id uuid, attendance_id uuid,
      started_at timestamptz, ended_at timestamptz null,
      end_reason text null,                                   -- 'final' | 'left' | 'timeout' | 'geofence_exit'
      distance_m int, accuracy_m int, visibility text default 'mutuals')  -- 'mutuals' | 'off'

-- reactions (prompt 3 fills these in)
reaction_prompts(id uuid pk, game_id uuid, kind text,          -- 'checkin' (the scheduled late-game one) | 'event'
                 event_id uuid null, fired_at timestamptz, window_seconds int,
                 audience text,                                 -- 'home' | 'away' | 'all'
                 significance numeric null, label text)         -- "React to Barkley's 90-yard TD"
reactions(id uuid pk, user_id uuid, game_id uuid, prompt_id uuid null,
          attendance_id uuid, back_path text, front_path text,
          captured_at timestamptz, late_seconds int, wp_seq int null,
          period_label text null, visibility text, post_id uuid null)

-- companion confirmation (tagging is now consent-based)
attendance_companions: add status text default 'pending',       -- 'pending' | 'confirmed' | 'declined'
                       confirmed_at timestamptz null, invited_by uuid

-- communities
communities(id uuid pk, slug text unique, name text, kind text, -- 'team' | 'venue' | 'school' | 'custom'
            team_id uuid null, venue_id uuid null, description text,
            is_official bool default true, owner_id uuid null,
            member_count int default 0, created_at)
community_members(community_id uuid, user_id uuid, role text default 'member', joined_at,
                  primary key(community_id, user_id))
community_posts(community_id uuid, post_id uuid, primary key(community_id, post_id))

-- leaderboards (materialized, recomputed on game finals)
leaderboard_stats(user_id uuid, community_id uuid, period text,  -- 'season' | 'month' | 'all'
                  season int null, stat_key text, value numeric, verified_only bool,
                  updated_at, primary key(user_id, community_id, period, season, stat_key))

-- streaks, badges, counts
season_streaks(user_id uuid, team_id uuid, sport_id text, start_season int, end_season int,
               seasons int, min_games int, is_active bool, updated_at,
               primary key(user_id, team_id))
badges(key text pk, name text, description text, criteria jsonb, tier text, is_secret bool)
user_badges(user_id uuid, badge_key text, earned_at, context jsonb, primary key(user_id, badge_key))
user_counts(user_id uuid, sport_id text, season int null, games int, verified_games int,
            primary key(user_id, sport_id, season))
favorite_games(user_id uuid, ordinal int, game_id uuid, note text null,
               primary key(user_id, ordinal))                    -- ordinal 1..4

-- moderation
blocks(blocker_id, blocked_id, created_at)                       -- existing
reports(id, reporter_id, target_type, target_id, reason, created_at, resolved_at, action text null)
mutes(user_id, muted_id, created_at)
```

Denormalized counters (`kudos_count`, `comment_count`, `member_count`, `followers_count`) are maintained by triggers, not by the client.

## 4. RLS, in words, then in SQL

- A post is visible to: its author; anyone if `visibility='public'` and the author's profile is public; followers if `visibility='followers'`. Never to a blocked user in either direction.
- Comments and kudos inherit the post's visibility. Authors can delete their own; post authors can delete comments on their post.
- Reactions follow the same visibility rules as posts, plus: a reaction with no post is private to its author, but still renders inside Relive for the attendance owner.
- Community membership is public; community posts inherit post visibility and additionally require membership if the community is private (none are at launch).
- `leaderboard_stats` is readable by community members only.
- Nobody can write another user's counters, badges, streaks, or leaderboard rows: those are service-role only.

## 5. Migration of existing data

Existing attendances become posts retroactively? **No.** Backfilling a feed with months of old logs would spam followers. Instead: existing attendances stay as they are, and only attendances created or confirmed after this release generate posts. Add `posts_backfilled_at` to profiles so this decision is inspectable.

## 6. Acceptance

- Every route above resolves, including deep links launched cold, with a back path that reaches a tab root.
- Tab state is preserved per tab across switching, and tapping the active tab pops to root.
- `supabase db reset` applies cleanly; RLS tests cover each bullet in section 4, including the block cases in both directions.
- Counter triggers are tested: kudos, unkudos, comment, delete, member join and leave.
- No UI for feed, reactions, or communities is shipped yet; the routes render simple placeholders.
- `SPEC.md` updated: section 5 with the new tables, section 8.7 with the five-tab map.
