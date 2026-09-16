# APPNAME: Product and Engineering Spec (v1 + roadmap)

> **Codename:** `APPNAME` is a placeholder. The real name is undecided (Turnstile and Witness are taken in this category). Use `APPNAME` / `appname` everywhere so it can be find-and-replaced later. Bundle ID: `com.deanyao.appname`.
>
> **Audience for this doc:** Claude Code, building from an empty repo. Read the whole doc before starting. Work milestone by milestone (Section 12). When something here is ambiguous or seems wrong once you're in the code, stop and ask rather than guessing. When a data source detail is marked **VERIFY**, confirm it against the live source before building on it.

---

## 1. Product summary

APPNAME is a passport for sports fans that turns every game you attend into a living record. Your personal record, team records, and pledged record, the stadiums you've collected, the players and moments you witnessed, and the people you were there with all add up to a fan identity that changes every time you show up.

The core idea that separates it from existing scrapbook apps (Momento, Turnstile Stubs, Footbeen, The Ballpark Witness): **being there is a game.** Your presence has a record. At a neutral game you pledge a side before it's too late, and the app tracks how well you pick against expectations. You have records with the people you go with ("7–1 with Dad"), rivalries with friends who root for other teams, and goals for the year.

Later phases extend it before the game (logistics, meetups, trip planning) and around it (stadium guides, seat reviews).

**This is a hobby project.** Optimize for low cost ($0 data), simplicity, and a working TestFlight build that friends can use at real games. No monetization in v1.

### Non-goals (do not build)
- Betting, prediction markets, odds display to users, or any wagering.
- Ticket resale or a marketplace.
- Live in-game chat.
- Team or league logos, wordmarks, or official marks anywhere (trademark risk). Use plain-text team names, abbreviations, and neutral colors.

---

## 2. Scope overview

### v1 (this spec, fully detailed)
1. Accounts and onboarding (Sign in with Apple, email OTP; pick favorite teams; home city).
2. Game data for **MLB and NFL**, domestic, current season plus historical back to at least 2000 where available.
3. Logging attended games three ways: manual search, ticket screenshot upload, and a personal forwarding email address.
4. Passport: overall, team, and pledge records; stadium stamps; superlatives; players seen; moments witnessed.
5. Map of stadiums visited.
6. Live check-in (geofenced) and the allegiance pledge, with "vs expected" using self-computed Elo win probabilities.
7. Companions, including people not on the app, with companion records and account linking.
8. One-way follows, a simple activity feed, reactions.
9. Rivalries and "before you connected" overlap.
10. Yearly goals and bucket lists.
11. Season Wrapped.
12. Share cards for Instagram stories.
13. Moderation and App Store requirements (report, block, account deletion).

### Later phases (Section 13, summarized)
Game-day planner, stadium guide and seat reviews, trip mode, meetups and displaced-fan hub, firsts and kid profiles, watched-games log, sportsbook odds for win probability, comments, more sports and leagues, keepsakes, Android.

---

## 3. Platform and stack

Mirror the stack Dean already uses for SalusLink so patterns and build tooling carry over.

| Layer | Choice |
|---|---|
| App | React Native with **Expo** (latest stable SDK), **TypeScript strict**, **expo-router** file-based navigation |
| Server state | TanStack Query |
| Local state | Zustand (only where needed) |
| Backend | **Supabase**: Postgres with row-level security on every table, Auth, Storage, Edge Functions (Deno), pg_cron |
| Batch ingestion | GitHub Actions scheduled workflows (free) for heavy jobs, especially NFL parquet processing; Supabase Edge Functions for light jobs |
| Maps | `react-native-maps` (Apple Maps on iOS, no API key or cost) |
| Location | `expo-location`, foreground only, used at check-in time |
| Notifications | `expo-notifications` (pledge window reminders, pledge results, goal completions) |
| Share cards | `react-native-view-shot` + `expo-sharing` |
| Ticket parsing | Anthropic API called only from an Edge Function (never from the client). Use a small, cheap vision-capable model. Current candidate: `claude-haiku-4-5-20251001`. VERIFY the model string and image input format at https://docs.claude.com/en/api/overview |
| Inbound email | Cloudflare Email Routing catch-all on a subdomain → Cloudflare Email Worker → HTTPS POST to a Supabase Edge Function (free; needs a domain on Cloudflare, about $10–15/yr) |
| Builds | EAS Build and EAS Submit → TestFlight → App Store |
| Testing | Jest + React Native Testing Library for app logic; pgTAP or SQL test scripts for RLS and record calculations; Deno tests for Edge Functions |

**Environment:** `.env` files for local, EAS secrets for builds, Supabase secrets for functions. The Anthropic API key and any service-role keys never ship in the app bundle.

**Costs to expect:** Apple Developer Program $99/yr, domain ~$12/yr, Anthropic API cents per parsed ticket. Everything else stays in free tiers. Note that Supabase free projects pause after a period of inactivity; keep a lightweight scheduled job running.

---

## 4. Data sources

The app needs very little live data. Nearly everything is computed after games end.

### 4.1 What's needed
- **Schedules:** game ID, sport, season, date and scheduled start (UTC), home and away teams, venue, status (scheduled, live, final, postponed, suspended, cancelled), doubleheader number.
- **Final results:** scores, winner, ties (NFL).
- **Box score appearances:** which players appeared, for "players seen."
- **Scoring timeline / play-by-play with wall-clock timestamps:** for moments, comebacks, and pledge validation.
- **Game context:** weather or temperature, duration, attendance where available (for superlatives).
- **Venues:** coordinates and a geofence radius (hand-curated seed file).

### 4.2 MLB: MLB Stats API (free)
Base: `https://statsapi.mlb.com/api/`. No key required.
- Schedule: `v1/schedule?sportId=1&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (includes `gamePk`, `gameDate`, teams, venue, status, `doubleHeader`, `gameNumber`, reschedule info).
- Game feed: `v1.1/game/{gamePk}/feed/live` includes `gameData` (venue, weather, datetime), `liveData.linescore`, `liveData.boxscore` (players who appeared), `liveData.plays.allPlays` with `about.startTime` / `about.endTime`, inning, half, and `result` (runs, event type, RBI, etc.).
- Venues: `v1/venues`.
- Teams: `v1/teams?sportId=1`.
- **VERIFY** exact field names against live responses before writing parsers, and snapshot a few real responses into `/fixtures` for tests.
- **License:** free for individual, non-commercial, non-bulk use; commercial use needs written permission from MLB Advanced Media. Fine for development and a small TestFlight group. **Before any public App Store launch, revisit this** (swap provider behind the adapter, or get permission). Keep ingestion rate-limited and cached; never have clients call MLB directly.

### 4.3 NFL: nflverse (free, open data)
- Schedules and results: nflverse `games` data (includes game ID, season, week, gameday, gametime, teams, scores, stadium, roof, temp, wind).
- Play-by-play: nflverse `pbp` releases per season (includes game clock, quarter, scoring plays, and a wall-clock time-of-day field). **VERIFY** the wall-clock column name and its timezone, and how soon after games data is published during the season.
- Player appearances: nflverse weekly rosters plus snap counts or weekly player stats. Define "appeared" as recorded at least one offensive, defensive, or special teams snap, or a stat line. **VERIFY** which release gives the most reliable appearance data by season.
- **VERIFY** the license of each dataset used before any public launch.
- Implementation: a GitHub Actions workflow (Python with `nflreadpy` or pandas + pyarrow) pulls data nightly in season, transforms it into the canonical schema, and upserts into Supabase with the service role key stored as a GitHub secret.
- **Live NFL data:** none in v1. NFL pledge locks are provisional and validated after data lands (Section 6.5).

### 4.4 Provider adapter
All ingestion goes through a `SportsDataProvider` interface so providers can be swapped later (commercial API, soccer, college). Canonical IDs are internal UUIDs; provider IDs live in mapping columns (`provider`, `provider_game_id`).

```ts
interface SportsDataProvider {
  sport: 'mlb' | 'nfl';
  fetchTeams(): Promise<CanonicalTeam[]>;
  fetchSchedule(range: DateRange): Promise<CanonicalGame[]>;
  fetchGameDetail(providerGameId: string): Promise<CanonicalGameDetail>; // score, appearances, scoring timeline, events, context
  fetchLiveState?(providerGameId: string): Promise<LiveState>; // MLB only in v1
}
```

### 4.5 Ingestion jobs
| Job | Where | Frequency |
|---|---|---|
| Seed teams, venues, aliases | script | once, then manual edits |
| Historical backfill (MLB 2000–present, NFL 2000–present or earliest available) | script / GitHub Action | once, resumable, rate-limited |
| MLB schedule sync (next 14 days, past 3 days) | Edge Function + pg_cron | every 6 hours |
| MLB finals and details | Edge Function + pg_cron | every 15 min during game windows; re-fetch each game once more ~12h after final to catch corrections |
| MLB live state (only games with an active check-in) | Edge Function | every 60s while any user is checked in |
| NFL schedule, finals, pbp, appearances | GitHub Action | nightly; daily during season |
| Elo update | SQL function / Edge Function | after each game goes final |
| Post-final processing (records, pledges, moments, goals, feed) | Edge Function triggered on status → final | on event |

Historical backfill must be idempotent and resumable, logging progress per season.

### 4.6 Venue seed file
Hand-curate `seed/venues.json` for every current MLB and NFL venue plus major former venues that appear in the historical range (e.g., old Yankee Stadium, Candlestick Park). Fields: name, city, state, lat, lng, geofence radius meters (default 400), opened and closed years, sports, provider venue IDs. Shared stadiums (e.g., one venue hosting two NFL teams) are one venue row.

---

## 5. Data model (Postgres)

All tables have RLS enabled. Reference data (teams, venues, games, events) is readable by any authenticated user and writable only by the service role. User data follows the privacy rules in Section 9.

### 5.1 Reference data
```
sports(id text pk: 'mlb' | 'nfl', name)
teams(id uuid pk, sport_id, name, city, abbreviation, primary_color_hex, active bool,
      provider, provider_team_id, franchise_id)           -- franchise_id links relocations/renames
team_aliases(team_id, alias text)                           -- "Phils", "Philly", "PHI", old names; used by ticket parsing
venues(id uuid pk, name, city, state, lat, lng, geofence_m int, opened_year, closed_year)
venue_aliases(venue_id, alias text)                         -- naming-rights changes
games(id uuid pk, sport_id, season int, game_type text,    -- regular, postseason, preseason
      scheduled_start timestamptz, venue_id, home_team_id, away_team_id,
      status text, home_score int, away_score int, winner_team_id uuid null, is_tie bool,
      doubleheader_number int null, rescheduled_from_game_id uuid null,
      temperature_f int null, duration_minutes int null, attendance int null,
      innings_or_periods int null, provider, provider_game_id, final_at timestamptz null,
      detail_ingested_at timestamptz null)
players(id uuid pk, sport_id, full_name, provider, provider_player_id)
game_appearances(game_id, player_id, team_id)
game_scoring_timeline(game_id, seq int, occurred_at timestamptz, period int, half text null,
      clock text null, home_score int, away_score int, description text)
game_events(id uuid pk, game_id, type text, player_id null, team_id null,
      occurred_at timestamptz null, detail jsonb)           -- moments, see 6.7
team_elo(team_id, as_of date, rating numeric)
game_win_prob(game_id pk, home_win_prob numeric, method text: 'elo_v1', computed_at)  -- frozen pregame
```

### 5.2 User data
```
profiles(id uuid pk = auth.users.id, handle text unique, display_name, avatar_path,
      home_city, home_lat, home_lng, is_private bool default false, created_at)
user_teams(user_id, team_id, created_at)                    -- favorite teams; many allowed
attendances(id uuid pk, user_id, game_id, source text: 'manual' | 'screenshot' | 'email' | 'checkin',
      verified bool, verified_via text null, section text null, row text null, seat text null,
      price_cents int null, note text null, rooting_team_id uuid null, rooting_basis text null,
      -- rooting_basis: 'favorite' | 'pledge' | 'chosen' (followed both teams) | null (neutral, no side)
      created_at, updated_at, unique(user_id, game_id))
people(id uuid pk, owner_user_id, display_name, linked_user_id uuid null, created_at)
      -- companions; a person may be a placeholder ("Dad") or linked to a real account
attendance_companions(attendance_id, person_id)
pledges(id uuid pk, user_id, game_id, team_id, pledged_at timestamptz,
      win_prob_at_pledge numeric, status text: 'provisional' | 'valid' | 'void',
      void_reason text null, result text null: 'win' | 'loss' | 'tie', unique(user_id, game_id))
checkins(id uuid pk, user_id, game_id, checked_in_at, distance_m int, accuracy_m int)
      -- do not store raw coordinates
follows(follower_id, followee_id, created_at, status text: 'active' | 'requested')
blocks(blocker_id, blocked_id, created_at)
reports(id, reporter_id, target_type, target_id, reason, created_at, resolved_at)
ticket_imports(id uuid pk, user_id, source text: 'screenshot' | 'email', storage_path text null,
      raw_text text null, parsed jsonb null, status text: 'pending' | 'parsed' | 'needs_review' | 'matched' | 'failed' | 'discarded',
      candidate_game_ids uuid[], matched_attendance_id uuid null, created_at)
inbound_addresses(user_id pk, token text unique, created_at, rotated_at)
user_emails(user_id, email text, verified bool)             -- allow-list for forwarded mail
bucket_lists(id uuid pk, owner_user_id null, title, description, is_curated bool, definition jsonb)
user_bucket_lists(user_id, bucket_list_id, added_at)
goals(id uuid pk, user_id, year int, title, definition jsonb, source text: 'template' | 'custom' | 'suggested',
      completed_at timestamptz null, created_at)
feed_events(id uuid pk, actor_user_id, type text, game_id null, payload jsonb, created_at, visibility text)
reactions(feed_event_id, user_id, emoji text, created_at)
wrapped_snapshots(user_id, sport_id, season, payload jsonb, generated_at)
user_stats_cache(user_id pk, payload jsonb, computed_at)
```

Indexes: `attendances(user_id)`, `attendances(game_id)`, `games(scheduled_start)`, `games(sport_id, season)`, `game_appearances(player_id)`, `follows(followee_id)`, `feed_events(actor_user_id, created_at desc)`.

Write migrations as plain SQL in `supabase/migrations`. Every RLS policy gets a test.

---

## 6. Domain rules

These rules are the heart of the product. Implement them as pure, well-tested functions (TypeScript in a shared `packages/core` or `lib/core` folder, mirrored in SQL where records are computed server-side). Tests should cover every edge case listed.

### 6.1 Rooting side for an attended game
Determine `rooting_team_id` for each attendance:
1. User follows exactly one of the two teams → that team, basis `favorite`.
2. User follows both teams → ask which side ("You follow both. Who are you rooting for?"), basis `chosen`. Until answered, no side.
3. User follows neither team:
   - If the user has a **valid** pledge for the game → pledged team, basis `pledge`.
   - Otherwise → no side (neutral). The game still counts for attendance, stamps, players seen, moments, superlatives, and companions (attendance-only stats), but not W/L.
4. Favorites are evaluated as of now, not as of the game date (simpler; a user who adopts a team later sees history recolor). Note this in settings copy.

### 6.2 Records
All records are **W–L–T** (ties only shown if nonzero). Only games with status `final` count. Postponed, suspended-and-not-completed, and cancelled games never count for W/L; if a ticket's game was postponed and replayed, the attendance should be moved to the makeup game (Section 7.4).

- **Overall record:** all attended games with a rooting side.
- **Team record:** for each followed team, attended games where rooting_team_id is that team.
- **Pledge record:** attended games with basis `pledge` and a valid pledge.
- **Pledge vs expected:** `sum(result_score - win_prob_at_pledge)` over valid pledges, where result_score is 1 for win, 0 for loss, 0.5 for tie. Display with sign and one decimal: "+2.4". Explain in UI: "How many more wins you've picked than expected."
- **Companion record:** for each person, overall record over attended games where that person is tagged.
- **Win rate:** wins / (wins + losses), ties excluded, three decimals like baseball (".646").

Records are computed in SQL views or functions and cached in `user_stats_cache`, recomputed when an attendance changes or a relevant game goes final or is corrected.

### 6.3 Check-in and verification
- **Check-in window:** from 3 hours before scheduled start until 1 hour after the game is final (or 6 hours after scheduled start if final status is unknown).
- **Geofence:** device location within `venue.geofence_m` (plus the reported accuracy, capped at +200m). Request location only when the user taps Check in. Store distance and accuracy, never raw coordinates.
- **Verified badge** is set when: a successful check-in exists, OR the attendance came from a parsed ticket screenshot, OR from a forwarded ticket email. Manual entries are unverified.
- **All logged games count** toward records regardless of verification. Verification is a badge, not a gate.
- **Pledges require a live check-in.** No pledging without being geofenced at the venue during the window.

### 6.4 Pledge flow
Eligibility: user is checked in and follows neither team.

Lock rules (whichever comes first):
- **MLB:** end of the 1st inning (after the bottom of the 1st completes), or the first run scored by either team.
- **NFL:** the first score by either team, or the moment the game clock reaches 10:00 remaining in the 1st quarter.

UX:
1. On check-in at a neutral game, show the pledge screen immediately and send a local notification if the user leaves it: "Pick a side before it locks."
2. Show both teams with pregame win probability, underdog labeled.
3. User can change their pick until lock. The stored `pledged_at` is the time of their final pick.
4. Show a countdown to the **estimated** lock:
   - MLB: use live state from the MLB Stats API (poll every 60s while checked in). Lock immediately when the live feed shows a run or the end of the 1st. If live data fails, fall back to scheduled start + 30 minutes.
   - NFL: scheduled start + 12 minutes as the estimate (no live data in v1). Copy must say it locks at first score or 10:00 in Q1, "estimated" timer.
5. After the estimated lock, pick buttons disable. Status is `provisional`.

### 6.5 Pledge validation (authoritative)
When game detail is ingested after final:
1. Compute the true lock time from `game_scoring_timeline` and play-by-play: MLB = min(time of first run, end time of the last play of the bottom of the 1st); NFL = min(time of first scoring play, wall-clock time of the first play at or after 10:00 in Q1).
2. If `pledged_at <= true_lock_time` → `valid`. Otherwise → `void` with reason `after_lock`. Allow a 60-second grace window for clock and feed skew.
3. If timestamps are missing or unreliable for a game, keep the pledge `valid` and flag it for logging (never punish users for missing data).
4. Set `result` from the final score. Notify the user: "Your pledge to the Bears won. Pledge record 11–9, +2.6 vs expected."
5. Voids notify gently: "Your pledge was made after the first score, so it doesn't count."

### 6.6 Win probability (Elo v1)
- Self-computed, no paid data. One Elo system per sport, processed chronologically over historical games, then updated after each final.
- Pregame home win probability: `p = 1 / (1 + 10^(-(elo_home + home_adv - elo_away) / 400))`.
- Starting parameters (tune by backtesting log loss on past seasons, and document chosen values in code):
  - MLB: K = 4, home_adv = 24, new-season regression 1/3 toward 1500.
  - NFL: K = 20, home_adv = 48, new-season regression 1/3 toward 1505, margin-of-victory multiplier.
  - Neutral-site games: home_adv = 0.
- Freeze `game_win_prob` before scheduled start; it must never change after a game begins. Pledges copy `win_prob_at_pledge` for the pledged team at pledge time.
- Design `method` field so a future sportsbook-odds source (`odds_v1`) can replace Elo per game without schema changes.

### 6.7 Moments witnessed (rule-based detectors)
Run detectors after game detail ingestion and write `game_events`. Each detector is a pure function over the canonical game detail with fixture-based tests.

MLB v1: walk-off (any type), walk-off home run, grand slam, cycle, no-hitter, perfect game, extra innings, shutout, immaculate inning (if detectable). Comebacks are handled in superlatives (6.8), not as moments.

NFL v1: overtime game, go-ahead or tying score in the final 2:00 of regulation, game-winning score as time expires, pick-six, fumble return TD, kickoff or punt return TD, safety, 50+ yard field goal, 14+ point comeback win.

Show on the passport ("Walk-offs witnessed: 2") and on each game's detail page.

### 6.8 Superlatives
Computed per user from attended final games:
- Coldest and hottest game (temperature), longest game (duration or innings), highest-scoring and lowest-scoring game.
- Biggest comeback witnessed by your side (max deficit overcome, from scoring timeline).
- Most-seen player (appearances count), most-seen player per followed team.
- Most-visited venue, farthest venue from home city, most miles traveled for one team (sum of great-circle distances from home city to each away venue attended for that team).
- Longest win streak and losing streak at games.
- Firsts: first game logged, first game at each venue.

Superlatives that can't be computed for a game (missing weather, etc.) simply skip that game.

### 6.9 Stamps
- A stamp per venue attended. Shows visit count, first visit date, and sports seen there.
- Former venues get a "closed" style stamp.
- Bucket lists display unvisited venues as ghost stamps.

### 6.10 Companions and people
- When logging or editing an attendance, tag companions from: your `people` list (placeholders you created) or users you follow.
- Tagging a followed user creates or reuses a `people` row linked to them (`linked_user_id`).
- Placeholder people ("Dad") can later be linked: the owner shares an invite link from the person's page; when the recipient signs up or opens it signed in and accepts, `linked_user_id` is set.
- On linking, offer the linked user an import: "Dean tagged you at 11 games. Add them to your passport?" Import creates attendances (source `manual`, unverified) for games they choose. Never auto-import without consent.
- Companion records use the tagging user's rooting side for that game.
- A user can remove tags of themselves from others' attendances.

### 6.11 Rivalries
- A rivalry exists between two users who follow each other (mutual) and who have favorite teams that have played each other.
- **Head-to-head** = games both users attended with opposing rooting sides. Tally wins per user. Split "together" (both tagged each other or both checked in) vs "apart."
- Also show "your teams' meetings you attended" per user as context.
- Rivalry cards only appear for mutual follows.

### 6.12 Overlap ("before you connected")
- Find games both users logged, for mutual follows only (privacy: a one-way follower must not learn which games you attended through overlap, even for public profiles, unless they also view your public passport normally).
- Games before the date the mutual follow began are labeled "before you connected."
- If both have seat info, show the section gap ("eleven sections apart") only if both users opted to share seats.

### 6.13 Goals
- Per user per calendar year. Created from templates, custom builder, or suggestions.
- Definitions are JSON predicates evaluated over the user's attendances and joined game data. Build a small, typed evaluator; do not use arbitrary SQL from the client.

```jsonc
// examples
{ "type": "count", "target": 20, "filter": { "sport": "mlb", "year": 2027 } }                       // attend 20 MLB games
{ "type": "distinct_venues", "target": 5, "filter": { "event": "home_run", "year": 2027 } }           // HRs in 5 ballparks
{ "type": "all_of", "items": [
    { "type": "distinct_venues", "target": 5, "filter": { "event": "home_run" } },
    { "type": "count", "target": 1, "filter": { "event": "walk_off" } } ] }
{ "type": "exists", "filter": { "team": "<uuid>", "venue_not_home": true } }                           // see your team on the road
{ "type": "record", "filter": { "rooting_basis": "pledge" }, "min_win_pct": 0.5, "min_games": 10 }
```

- Templates: attend N games, visit N new stadiums, see your team on the road, win N pledges, beat expected, witness a walk-off, go with N different people.
- Suggestions: computed from last year's totals ("You went to 14 games last year. Try 18?"). Offer on January 1 and in onboarding.
- Progress recomputes on attendance change and game finals. Completion creates a feed event and notification.

### 6.14 Bucket lists
- Curated lists seeded by us: all 30 MLB ballparks, all NFL stadiums, each division's venues, and simple achievement lists (see a walk-off, see a no-hitter, see your team in every division rival's park).
- Custom lists: user picks venues or games-with-conditions using the same predicate format as goals, without a year.
- Lists show progress ("21 of 30") and ghost stamps on the map.

### 6.15 Season Wrapped
- Per user, per sport, per season. Generated after the season's final game (World Series, Super Bowl) and on demand as a preview.
- Card sequence: games attended, record and team records, pledge record and vs expected, stadiums and new stamps, most-seen player, top moment, best companion record and worst ("jinx"), miles traveled, top superlative, goals completed.
- Store the payload in `wrapped_snapshots`. Each card is shareable.

### 6.16 Feed
- Shows events from users you follow: logged a game, won or lost a pledge, new stamp, goal completed, milestone (10th, 25th, 50th, 100th game), Wrapped published.
- Reactions: a small fixed emoji set. No comments in v1.
- Respect blocks and private profiles everywhere.

### 6.17 Share cards
Generated client-side as 1080×1920 images. Templates: passport record, single game (score, venue, date, your side, verified badge), pledge result, stamp unlocked, companion record, goal completed, Wrapped cards. Include the app name and handle, never team logos.

---

## 7. Logging games and imports

### 7.1 Manual search
- Search by team, opponent, venue, date or date range, season. Typeahead uses `team_aliases` and `venue_aliases`.
- Results show date, matchup, venue, final score. Tap to log.
- Log sheet: companions, seat (section, row, seat), price, note. All optional.
- "Bulk mode" for backfill: multi-select games from a team's season list ("Phillies 2019 home games") and log them in one go.

### 7.2 Ticket screenshot or PDF upload
1. User picks one or more images or PDFs. Upload to a private Storage bucket `ticket-imports/{user_id}/`.
2. Create `ticket_imports` rows (status `pending`) and call the `parse-ticket` Edge Function.
3. The function sends the image to the Anthropic API with a strict JSON output instruction:
   ```json
   { "sport": "mlb|nfl|unknown", "home_team": "", "away_team": "", "date_local": "YYYY-MM-DD", "time_local": "HH:MM|null",
     "venue": "", "section": "", "row": "", "seat": "", "price": null, "ticketing_platform": "", "confidence": 0.0 }
   ```
   Validate with a schema (zod). Retry once on invalid JSON.
4. Run the matcher (7.4). Exactly one strong candidate → status `matched` with a confirm card. Multiple or low confidence → `needs_review` with candidates. None → `failed` with a manual search shortcut.
5. User confirms → attendance created (source `screenshot`, verified).
6. **Security:** ticket images can contain valid barcodes for future games. Never show import images to other users, never put them in the feed, and delete the stored image 7 days after the import is resolved (configurable). Blur or crop nothing server-side; just don't expose it.

### 7.3 Forwarding email address
- Each user gets `u-{token}@in.<domain>` (token random, 10+ chars, rotatable in settings).
- Cloudflare Email Worker receives mail for `*@in.<domain>`, extracts token, text, HTML, and PDF attachments, and POSTs to the `inbound-email` Edge Function with a shared secret header.
- The function checks: token exists, and the sender (`From`) matches one of the user's verified `user_emails` (users add emails in settings with an OTP). Mail from unknown senders is dropped and the user is notified once per day at most ("We got mail from an address you haven't added").
- A single email can contain multiple games (season plans). Parse all, create one `ticket_imports` row per ticket, then match.
- Parsing uses the same function as screenshots, with text input first and PDF attachments as a fallback.
- Onboarding shows the address with copy: "Forward ticket confirmations from any site (Ticketmaster, SeatGeek, StubHub, TickPick, team sites) to this address."
- Forwarded confirmations for **future** games create a "Going" entry that converts to an attendance once the game is final, and prompts check-in on game day.

### 7.4 Game matcher
Input: parsed ticket fields. Output: ranked candidate games.
1. Normalize teams via `team_aliases` (handles city-only names, nicknames, abbreviations, historical names).
2. Normalize venue via `venue_aliases`.
3. Candidate window: date ±1 day (timezones and late games).
4. Score: team match (both teams strongly weighted), date proximity, venue match, start time proximity.
5. Doubleheaders: use start time to choose game 1 vs 2; if unknown, ask.
6. Postponed games: if the matched game is postponed and has a makeup game, suggest the makeup game ("This game was postponed to Aug 16. Log that one?").
7. Preseason and postseason included.
8. Unit-test with a fixture set of at least 30 real-world-style ticket strings, including misspellings and naming-rights venue names.

---

## 8. Screens and navigation

The UI mockup (`turnstile-ui.html`, attached alongside this spec) is the reference for screen structure and hierarchy. **Colors, type, and styling are placeholders** and will change; build with a theme token file so restyling is cheap. Support light and dark mode from day one.

Tab bar (v1): **Passport**, **Games**, **Friends**, **You**. (A Plan tab arrives with the game-day planner in a later phase.)

### 8.1 Onboarding
1. Welcome → Sign in with Apple or email OTP.
2. Handle and display name.
3. Pick favorite teams (MLB and NFL, multi-select, searchable).
4. Home city (for miles traveled and the map), optional.
5. Add past games: three options (search, upload tickets, forwarding address). Skippable.
6. Location and notification permission primers, requested only when relevant later (not upfront).

### 8.2 Passport (home tab)
Mirrors mockup screen 1:
- Header: name, totals (games, stadiums, states).
- Record card: overall record large, win rate, then team record tiles and the pledge tile with vs expected.
- Stamps grid (preview) → full stamps screen.
- Superlatives list → full superlatives screen.
- Moments witnessed and players seen → list screens (players seen sorted by count, searchable).
- Map entry → Map screen (8.6).
- Goals and bucket lists preview → Goals screen (8.7).
- Wrapped banner when available.
- Share button → share card picker.

### 8.3 Games tab
- Segments: **Upcoming** (games from forwarded tickets and "Going"), **Log a game** (search), **History** (all attendances, filter by sport, team, season, venue, companion, verified).
- Today banner: if a logged or nearby game is today, prominent **Check in** button.
- Imports inbox: pending and needs-review ticket imports with a badge count.
- Game detail: score, date, venue, your side, verified badge, companions, seat, note, moments from this game, players seen, pledge result, followed users who were also there (mutuals only). Edit and delete.

### 8.4 Check-in and pledge
Mirrors mockup screen 2:
- Check in flow: permission primer → location → success ("You're at Soldier Field") or failure with reason (too far, outside window).
- If neutral: pledge screen with countdown, two team buttons with win probability and underdog label, confirmation text, and explanation of vs expected.
- If a favorite is playing: "Rooting for the Eagles. Good luck." with companions quick-tag.
- If both favorites: side picker.
- Post-lock state and later result state.

### 8.5 Friends tab
Mirrors mockup screen 5:
- Feed (default segment).
- **With**: companion records list (people and linked users), sorted by games together; tap for detail with shared game list and record.
- **Rivals**: rivalry cards for mutuals.
- **Overlap**: "before you connected" cards.
- Find people: search handles, invite link, contacts import out of scope for v1.

### 8.6 Map
- Apple Maps with markers for visited venues (sized or labeled by visit count) and ghost markers for bucket-list venues.
- Optional lines from home city to each visited venue.
- Filter by sport and team. Tap marker → venue sheet with visits and games.

### 8.7 Goals and bucket lists
- This year's goals with progress bars, suggested goals, create goal (template picker + parameters).
- Bucket lists: joined lists with progress, browse curated lists, create custom list.

### 8.8 Wrapped
Full-screen swipeable cards per sport and season, each shareable.

### 8.9 You (profile and settings)
- Public profile preview (what others see).
- Edit profile, favorite teams, home city.
- Privacy: private account, share seat info, show on overlap.
- Forwarding address (copy, rotate) and verified sender emails.
- Notifications settings.
- Blocked users.
- Export my data (JSON), delete account (required by App Store).
- About, data attributions (MLB, nflverse), terms, privacy policy.

### 8.10 Other users' profiles
Passport view (records, stamps, map, moments) subject to privacy; follow or request; report and block in overflow menu.

---

## 9. Privacy and safety

- Profiles public by default; private accounts require follow approval and hide attendances, records, and feed events from non-followers.
- Seat info private by default; opt-in to show on game detail to mutuals.
- Overlap and rivalries: mutual follows only.
- Never store raw location coordinates. Location is requested only at check-in.
- Ticket images private, auto-deleted (7.2). Parsed fields retained.
- Placeholder people are visible only to their owner.
- Blocks are symmetric in effect: blocked users can't see each other's profiles, feed events, overlap, or tags.
- Age: 13+ (App Store age rating and signup gate). Kid sub-profiles are a later phase.
- Data export and full account deletion (including Storage objects and imports) must work end to end.
- RLS test suite must prove: private profile data is hidden from non-followers, blocked users see nothing, placeholder people are owner-only, ticket imports are owner-only.

---

## 10. Notifications
- Game day morning: "Phillies at 7:05 tonight. Check in when you get there." (for Going games)
- Pledge window: on check-in at a neutral game if the pledge screen is dismissed.
- Pledge result and void.
- Goal completed, new stamp, milestone.
- Someone you follow tagged you at a game, or linked a placeholder to you.
- New follower or follow request.
- Import needs review.
- Wrapped ready.
All individually toggleable.

---

## 11. App Store and TestFlight requirements
- Apple Developer Program account; EAS Build with production profile; EAS Submit to TestFlight.
- Internal testing first (no review), then an external TestFlight group via public link (beta review).
- Sign in with Apple as the primary sign-in, plus email OTP. Do not add Google or other social logins without also keeping Sign in with Apple.
- In-app account deletion.
- User-generated content safeguards: report content and users, block users, a way to contact us, and a documented moderation response. Handles and display names pass a profanity filter.
- Location permission strings explain the check-in use precisely. Foreground only.
- Privacy manifest and App Privacy "nutrition label" accurately list: account info, location (not linked to raw coordinates, used for verification), user content (ticket images), identifiers.
- No team logos or league marks in screenshots, icon, or listing. Avoid league names in the app name and subtitle.
- Data attribution screen for MLB and nflverse.
- Before public release: resolve the MLB data licensing question (4.2) and nflverse licenses (4.3).

---

## 12. Build plan (milestones)

Each milestone ends with passing tests, a short README update, and a TestFlight-capable build once M2 exists. Do not start the next milestone with failing tests.

**M0. Repo and infrastructure**
Monorepo (`apps/mobile`, `supabase/`, `packages/core`, `ingest/`). Expo app with expo-router, TypeScript strict, ESLint, Prettier, theme tokens (light and dark). Supabase project, local dev with Supabase CLI, migration pipeline, CI running tests. EAS project configured.
*Done when:* app boots to a placeholder tab bar in the simulator, CI is green, `supabase db reset` works.

**M1. Reference data and ingestion**
Schema 5.1. Venue and team seeds with aliases. MLB adapter (schedule, game detail, appearances, scoring timeline, weather, duration) with fixtures. NFL GitHub Action (schedules, results, pbp timeline, appearances). Historical backfill scripts (resumable). Scheduled sync jobs. Elo computation and frozen pregame win probabilities. Moment detectors.
*Done when:* every MLB and NFL game 2000–present exists with finals; spot-check 20 known games for score, venue, appearances, and at least one detected moment each (e.g., a known walk-off); Elo backtest log loss is printed and parameters recorded.

**M2. Auth, onboarding, manual logging**
Schema 5.2 (profiles, user_teams, attendances, people, companions). Sign in with Apple and email OTP. Onboarding flow. Manual search and log sheet. Bulk mode. Game detail. RLS policies with tests.
*Done when:* a new user can sign up, pick teams, log 10 past games including a doubleheader, see them in History, and cannot read another user's private data (tested).

**M3. Passport**
Rooting side logic, records (overall, team), win rate, stamps, superlatives, players seen, moments witnessed. Stats cache and recompute triggers. Passport screen and detail screens per mockup.
*Done when:* core rules in Section 6.1–6.2 and 6.7–6.9 have unit tests for all listed edge cases (ties, postponed games, neutral games, both favorites, relocated franchises), and the passport renders correctly for a seeded test user with 50 games.

**M4. Ticket imports**
Screenshot and PDF upload, parse-ticket function, zod validation, matcher with fixture tests, imports inbox and review UI. Cloudflare Email Worker, inbound-email function, sender allow-list, forwarding address UI, future "Going" games.
*Done when:* 30-fixture matcher suite passes; a real forwarded confirmation and a real screenshot each produce a verified attendance end to end; images auto-delete.

**M5. Check-in and pledge**
Geofenced check-in, verification badge, pledge screen, MLB live polling with lock detection, NFL estimated lock, provisional pledges, post-final validation, pledge record and vs expected, notifications.
*Done when:* simulated games (fixtures replayed with a fake clock) prove lock and validation logic for: pledge before first run, pledge after first run (void), MLB scoreless 1st (lock at end of inning), NFL first score before 10:00, NFL no score by 10:00, missing timestamps (stays valid).

**M6. Companions**
Tagging people and followed users, companion records, placeholder people, invite and link flow, consent-based import of tagged games, remove-self-from-tag.
*Done when:* a placeholder "Dad" tagged at 5 games is linked to a new account, that account imports 3 of them, and records are correct for both users.

**M7. Social**
Follows (public and private with requests), feed events, reactions, rivalries, overlap, blocks, reports, profanity filter, profile views.
*Done when:* RLS tests cover private accounts, blocks, and mutual-only overlap and rivalries; feed paginates.

**M8. Map, goals, bucket lists**
Map screen with visited and ghost markers and home lines. Goal predicate evaluator with tests, templates, suggestions, progress recompute. Curated bucket lists seeded, custom lists.
*Done when:* the evaluator passes tests for every example in 6.13; "HR in 5 ballparks with a walk-off" goal completes on seeded data and fires a notification.

**M9. Share cards and Wrapped**
All share card templates. Wrapped generation job, storage, swipeable UI, per-card sharing.
*Done when:* share cards render correctly in light and dark on small and large iPhones; Wrapped generates for a seeded user for MLB 2026.

**M10. TestFlight hardening**
Account deletion and data export, settings completeness, attributions, empty and error states for every screen, offline handling (cached passport readable offline), performance pass (passport loads under 1s from cache), crash reporting (Sentry free tier or Expo equivalent), App Store privacy details, external TestFlight group.
*Done when:* a friend with no context can install via TestFlight, onboard, import tickets, and check in at a game without help.

---

## 13. Later phases (roadmap)

Specify each fully before building. Summaries capture intent.

**Game-day planner.** Upload or select a ticket and answer a few questions (tailgate, meetup, post-game, driving or transit, who's coming) to generate an itinerary: when to leave, parking or transit, which gate to enter, tailgate spot, post-game spot. Venue logistics (gates, lots, tailgate areas) don't exist in any API and must be curated, so launch for a handful of stadiums first. Adds the Plan tab.

**Stadium guide.** Interactive per-venue guide: Beli-style ranked food, bathrooms (cleanliness, wait), shortest lines, seat views. Ratings only from users who logged a game at that venue.

**Seat reviews.** Rate your seat from the attendance log (view, sun or shade, value, notes, photo). Aggregated per section. Byproduct of logging, not a separate flow.

**Trip mode.** "You're in Chicago this weekend": games nearby, bucket-list venues nearby, affiliate ticket links (first monetization candidate).

**Meetups and displaced-fan hub.** Supporter groups, bars, tailgates, and watch parties by team and city, plus post-game gatherings. Note that FanWide and MyTeamSports.US exist; differentiate by tying into records and the game-day plan.

**Watched games log.** Log and rate games watched on TV or at a watch party, with a separate "watched" record.

**Firsts and families.** Special keepsake cards for firsts (first game, first away game, first playoff game, first game in a country); kid sub-profiles managed by a parent; time-capsule notes that unlock on an anniversary or a birthday; "on this day" resurfacing.

**Physical keepsakes.** Print-on-demand posters, stubs, and certificates via an API such as Printful or Gelato, using facts and original design only (no logos).

**Sportsbook odds for win probability.** Add an `odds_v1` method using a free or cheap odds API tier with one pregame moneyline snapshot per game; keep Elo as fallback.

**More sports and leagues.** Soccer (MLS, Real Madrid and European clubs' US tours, then European leagues), college football and basketball, college baseball and soccer, MiLB, NBA, NHL. Each requires a provider adapter and venue seeds.

**Comments, Android, historical iconic moments** (curated list of famous games so a user who attended one gets a special badge), **player chasing** (active stars you haven't seen yet), **Gmail OAuth import** (requires Google's annual security assessment; forwarding address covers the need until then).

---

## 14. Open questions to confirm with Dean during the build
1. Final app name (replace `APPNAME`).
2. Whether historical favorites should be time-aware (6.1.4) once users ask for it.
3. Default geofence radius per venue type after first real-world tests.
4. How long to keep ticket images (default 7 days).
5. Whether "Going" entries for future games should appear in the feed.
6. Commercial data plan before any public App Store release.
