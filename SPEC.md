# Jinx: Product and Engineering Spec (v1 + roadmap)

> **Revision 7.** Adds `docs/ACCOUNTS.md` (accounts, identifiers, access setup) and an M0 access check. The Relive scorebug uses the circular team badges.
>
> **Revision 6.** Figma is no longer read directly. Passport, Pick a side, and Games from the Figma design have been recreated in `design/reference.html` with corrections applied, so the HTML reference is again the single visual source of truth for every screen (Section 8).
>
> **Revision 5.** Sign in with Apple is the only sign-in method until email is set up with Resend and a domain. Email OTP and the forwarding address are deferred to when the domain exists (Sections 2, 7.3, 8.1 onboarding, 12).
>
> **Revision 4.** The app is named **Jinx**. Figma is now the design source of truth for Passport, Games, and Pick a side, with `design/reference.html` covering all other screens and all interactions until they are designed in Figma (Section 8.1, `design/FIGMA_NOTES.md`).
>
> **Revision 3.** Game detail is now fetched on demand instead of bulk-ingested for all history (Sections 2, 4.5, 4.7, 12), to stay within the Supabase free database limit. Email uses Resend.
>
> **Revision 2.** Adds the UI v3 design system (Section 8, rewritten), "As a neutral" naming, record game logs, Relive, and storylines. The visual reference is `design/reference.html`. Where this spec and the reference disagree on anything visual, the reference wins.

> **Name:** Jinx. Bundle ID: `com.deanyao.jinx`. Display name on the home screen: Jinx. The App Store listing name may need a suffix if "Jinx" is taken (e.g., "Jinx: Sports Fan Record"); confirm with Dean before creating store metadata.
>
> **Audience for this doc:** Claude Code, building from an empty repo. Read the whole doc before starting. Work milestone by milestone (Section 12). When something here is ambiguous or seems wrong once you're in the code, stop and ask rather than guessing. When a data source detail is marked **VERIFY**, confirm it against the live source before building on it.

---

## 1. Product summary

Jinx is a passport for sports fans that turns every game you attend into a living record. Your personal record, team records, and pledged record, the stadiums you've collected, the players and moments you witnessed, and the people you were there with all add up to a fan identity that changes every time you show up.

The core idea that separates it from existing scrapbook apps (Momento, Turnstile Stubs, Footbeen, The Ballpark Witness): **being there is a game.** Your presence has a record. At a neutral game you pledge a side before it's too late, and the app tracks how well you pick against expectations. You have records with the people you go with ("7–1 with Dad"), rivalries with friends who root for other teams, and goals for the year.

Later phases extend it before the game (logistics, meetups, trip planning) and around it (stadium guides, seat reviews).

**This is a hobby project.** Optimize for low cost ($0 data), simplicity, and a working TestFlight build that friends can use at real games. No monetization in v1.

### Non-goals (do not build)
- Betting, prediction markets, odds display to users, or any wagering.
- Ticket resale or a marketplace.
- Live in-game chat.
- Team or league logos, wordmarks, or official marks anywhere (trademark risk). Use the circular team badges from the reference (team initials in team colors), plain-text names, and team colors.
- Emojis anywhere in the UI. All iconography is the custom SVG icon set from the reference.
- Hosting league broadcast clips or highlights. Link out to official highlights only.

---

## 2. Scope overview

### v1 (this spec, fully detailed)
1. Accounts and onboarding (Sign in with Apple only for now; email one-time codes added once Resend and a domain are set up; pick favorite teams; home city).
2. Game data for **MLB and NFL**, domestic: schedules and final scores for every game from 2000 to present; full game detail (appearances, scoring timeline, win probability, moments, weather) fetched on demand only for games users log, check in to, or plan to attend (Section 4.7).
3. Logging attended games three ways: manual search, ticket screenshot upload, and a personal forwarding email address (the forwarding address ships once the domain exists; build it behind a feature flag).
4. Passport: overall, team, and neutral records, each opening a game log; stadium stamps drawn from stadium shapes; superlatives; players seen; moments witnessed.
5. Map of stadiums visited.
6. Live check-in (geofenced) and picking a side at neutral games (internally "pledge"; shown to users as "As a neutral" and "Pick a side"), with "vs expected" using self-computed Elo win probabilities, plus pregame storylines.
7. Companions, including people not on the app, with companion records and account linking.
8. One-way follows, a simple activity feed, reactions.
9. Rivalries and "before you connected" overlap.
10. Yearly goals and bucket lists.
11. Season Wrapped.
12. Share cards for Instagram stories.
13. Relive: a per-game story replay with a win probability line, your photos, photos from other fans at the game, and a link to official highlights.
14. Moderation and App Store requirements (report, block, account deletion).
15. UI shells for the game-day planner (Plan tab) and stadium guide, built to the reference with demo data behind a feature flag, so the full design exists before those features are implemented.

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
| Transactional email | Resend (free plan: 3,000/month, 100/day, one domain), configured as Supabase Auth custom SMTP for login codes |
| Inbound email | Preferred: Resend inbound on the same domain → webhook to a Supabase Edge Function. VERIFY inbound is available on the free plan and that received mail counts toward the same quota. Fallback: Cloudflare Email Routing catch-all → Cloudflare Email Worker → Edge Function |
| Builds | EAS Build and EAS Submit → TestFlight → App Store |
| Testing | Jest + React Native Testing Library for app logic; pgTAP or SQL test scripts for RLS and record calculations; Deno tests for Edge Functions |

**Environment:** `.env` files for local, EAS secrets for builds, Supabase secrets for functions. The Anthropic API key and any service-role keys never ship in the app bundle. Accounts, identifiers, and how each service is connected are listed in `docs/ACCOUNTS.md`.

**Costs to expect:** Apple Developer Program $99/yr (already paid through SalusLink's account), domain ~$12/yr, Anthropic API cents per parsed ticket. Everything else stays in free tiers. Note that Supabase free projects pause after a period of inactivity; keep a lightweight scheduled job running.

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

### 4.3b In-game win probability, injuries, and probable starters
- **NFL in-game win probability:** nflverse play-by-play includes per-play win probability columns. VERIFY column names (home team WP).
- **MLB in-game win probability:** check whether the MLB Stats API exposes a per-play win probability endpoint for a game. VERIFY. If not, compute a simple state-based model (inning, outs, base state, score differential) from historical play-by-play, or fall back to scoring-play-only story steps with no line.
- **NFL injuries:** nflverse publishes weekly injury report data. VERIFY availability and timing.
- **MLB probable pitchers:** available on the schedule endpoint with a probable pitcher hydration. VERIFY.

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
| Historical backfill: schedules and final scores only (MLB and NFL, 2000–present) | script / GitHub Action | once, resumable, rate-limited |
| MLB schedule sync (next 14 days, past 3 days) | Edge Function + pg_cron | every 6 hours |
| MLB finals (scores and status for all games) | Edge Function + pg_cron | every 15 min during game windows |
| Game detail on demand (both sports) | Edge Function worker reading `detail_queue` | continuously; see 4.7 |
| MLB live state (only games with an active check-in) | Edge Function | every 60s while any user is checked in |
| NFL schedules and finals; detail for queued NFL games | GitHub Action | nightly, daily during season |
| Elo update | SQL function / Edge Function | after each game goes final |
| Post-final processing (records, pledges, moments, goals, feed) | Edge Function triggered on status → final | on event |
| Welcome wall: score the last week's finals for notability and store the six most recognizable in `welcome_wall_cards` (Section 8.8) | SQL function `welcome_wall_refresh()` + pg_cron, no Edge Function in the path | Mondays 13:00 UTC, plus Fridays 13:00 UTC from September to February |

Historical backfill must be idempotent and resumable, logging progress per season.

### 4.7 On-demand game detail
The database must stay well under the Supabase free plan's 500 MB limit (target under 300 MB). Only schedules and final scores are stored for all games. Full detail is stored only for games someone cares about.

- **What counts as detail:** `game_appearances`, `game_scoring_timeline`, `game_wp_timeline`, `game_story_steps`, `game_events`, and context fields (weather, duration, attendance).
- **Triggers:** a row is added to `detail_queue(game_id, reason, requested_at, attempts, last_error, done_at)` when an attendance is created, a check-in happens, a "Going" entry is created, or a ticket import matches a game. Future games are queued but processed only after they go final.
- **MLB worker:** an Edge Function drains the queue for MLB games, fetches the game feed, writes detail, sets `games.detail_ingested_at`, and re-fetches once about 12 hours after final to catch scoring corrections.
- **NFL:** play-by-play arrives as season files. The nightly GitHub Action processes all queued NFL games from those files. When a user logs a historical NFL game, show a "Details arrive overnight" state for moments, players seen, and Relive; records and stamps work immediately because they only need final scores.
- **Downstream:** when detail lands, recompute that game's moments, the stats caches of every user who attended it, pledge validation, goals, and Relive steps.
- **UI:** while detail is pending, game detail and Relive show a loading state styled from the design system; superlatives and players seen simply exclude the game until then.
- **Elo** needs only final scores, so it is computed over full history without detail.
- **Monitoring:** a weekly job logs database size; alert in logs above 350 MB.

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
team_colors(team_id pk, primary_light, secondary_light, on_primary_light, primary_dark, secondary_dark, on_primary_dark)
      -- dark variants are separate, hand-tuned values (see reference .t-* classes); never compute them
venue_shapes(venue_id pk, svg_path text, source text: 'placeholder' | 'osm_traced', simplified_at)
game_wp_timeline(game_id, seq int, period int, half text null, home_wp numeric, occurred_at timestamptz null)
game_story_steps(game_id, seq int, wp_seq int, away_score int, home_score int, label text, text text)
storylines(id uuid pk, game_id, team_id, text, source text: 'results' | 'injury_report' | 'probable_starter', facts jsonb, generated_at)
team_elo(team_id, as_of date, rating numeric)
game_win_prob(game_id pk, home_win_prob numeric, method text: 'elo_v1', computed_at)  -- frozen pregame
welcome_wall_cards(week_start date, rank int 1..6, payload jsonb, created_at, pk (week_start, rank))
      -- the signed-out welcome screen's six game cards for the week (8.8); payload holds title, venue,
      -- played_on, night, date_label, result, team_key (provider:provider_team_id), never user data
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
attendance_photos(id uuid pk, attendance_id, user_id, storage_path, kind text: 'photo' | 'video', visibility text: 'private' | 'followers' | 'public', created_at)
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
- **Neutral record** (UI label: "As a neutral"; internal name: pledge record): attended games with basis `pledge` and a valid pledge.
- **Pledge vs expected:** `sum(result_score - win_prob_at_pledge)` over valid pledges, where result_score is 1 for win, 0 for loss, 0.5 for tie. Display with sign and one decimal: "+2.4". Explain in UI: "How many more wins you've picked than expected."
- **Companion record:** for each person, overall record over attended games where that person is tagged.
- **Win rate:** wins / (wins + losses), ties excluded, three decimals like baseball (".646").

- **Record game logs:** every record shown anywhere (overall, each team, as a neutral, home, road, playoffs, each companion) is tappable and opens the list of games that make up that record, newest first, with a W/L/T circle per game. For neutral games the row shows the team picked, the win probability at pick time, and the vs-expected delta ("Won, picked at 38%, +0.62"). The log header repeats the record in the relevant team's color.

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
4. Set `result` from the final score. Notify the user: "The Bears won. You're 11–9 as a neutral, +2.6 vs expected."
5. Voids notify gently: "Your pick came after the first score, so it doesn't count."

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
- **Loudest stadium visited** appears in the Figma design but has no data source. v1 shows it only in demo mode. Candidate later feature: an opt-in crowd noise reading from the phone microphone during check-in (needs microphone permission and calibration caveats). Confirm with Dean.

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

### 6.18 Storylines
- Shown on the Pick a side screen, and optionally on the Upcoming games list.
- Generated pregame (morning of, refreshed 1 hour before start) per team from facts only: current streaks, home/road record, last meeting result, injury report entries for key players, MLB probable pitchers.
- Pipeline: compute a facts JSON per team from the database → send facts to the Anthropic API from an Edge Function → get back 1 to 3 one-sentence storylines per team → validate each sentence only references provided facts (reject and regenerate otherwise) → store in `storylines` with the source label shown in the UI ("From results", "Official injury report").
- Never generate claims that aren't in the facts JSON. No news scraping.

### 6.19 Relive
- Available on every attended game that is final and has detail ingested; opened from any game row or game detail.
- **Scorebug:** away team badge (circular initials badge, same as Pick a side) and name, score, period label, home team badge and name.
- **Story player:** a play button steps through `game_story_steps` every 1.7 seconds (pause and resume supported; restarts at the end). Each step updates the score, the period label, the story card text, and draws the win probability line up to that step with a dot at the current point.
- **Story steps** are generated after final from the scoring timeline: a pregame step (pregame win probability), one step per scoring play, and a final step that includes a personal line from the user's own data (e.g., "Your record with Dad goes to 7–1"). Base text is templated from play-by-play; the personal final line is computed per user at view time, not stored.
- **Your photos:** grid of the user's photos and videos for that attendance, plus an add tile (camera icon). Upload to private Storage; visibility per item.
- **From fans at this game:** public photos from other users' attendances at the same game, only from public accounts, only items marked public, excluding blocked users. Count shown in the section header.
- **Official highlights:** a row that opens the league's official video page for the game in the browser. No embedded or hosted clips.
- Fan uploads get the same report and block tools as other user content.

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
- The inbound provider (Resend inbound preferred, Cloudflare Email Worker as fallback) receives mail for `*@in.<domain>` and delivers token, text, HTML, and PDF attachments to the `inbound-email` Edge Function with a verified webhook signature or shared secret.
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

## 8. Design system and screens

### 8.1 Source of truth
`design/reference.html` is the visual specification for every screen. Passport, Pick a side, and Games in it were recreated from Dean's Figma design (see `design/figma/passport-games-pick-side.png` for the original, context only) with the corrections in `design/FIGMA_NOTES.md` already applied. The other screens come from the earlier concept and will be restyled later to match; until then, build them exactly as they appear in the reference.

The shipped app must match the reference screen for screen: layout, spacing, sizes, radii, colors (light and dark), typography, iconography, copy, and interactions. The phone frames, fake status bars, page header, captions, and theme toggle are presentation only. The real iOS status bar and safe areas replace them.

### 8.2 Tokens (extract verbatim from the reference CSS)
- Base palette: `--bg`, `--scr`, `--canvas`, `--card`, `--surface`, `--ink`, `--muted`, `--line`, `--link`, `--good`, `--bad`, `--warn` with light and dark values from `:root` and the dark blocks.
- Team palettes: `--tf` (fill color, the same in both themes, used for badges, buttons, pills, thumbnails, and the hero glow), `--t` (accent for text and small marks, with a separate dark-mode value), `--t2` (secondary, used for rings and borders), `--on` (text on `--t`), per team from the `.t-*` classes. Store them in `team_colors`; add hand-tuned dark variants for every MLB and NFL team using the same approach (a lighter, higher-contrast primary for dark mode).
- `.t-none` is the neutral theme (ink as accent) used for All teams and neutral contexts.
- Typography: Archivo. The reference uses the variable width axis (`wdth` 62–100). React Native doesn't reliably support variable font axes, so generate static font instances for each width and weight used in the reference (for example with fontTools `varLib.instancer`) and bundle them with expo-font.
- Radii, spacing, and font sizes: take exact values from the CSS classes (for example the hero card is 24px radius, 16px padding; tiles 16px radius; list rows 11px vertical padding; the tab bar icon is 23px).
- Motion: side panels slide in from the right over 320ms with `cubic-bezier(.2,.8,.2,1)`; the hero card background transitions over 250ms; the live dot pulses at 1.6s. Respect Reduce Motion.

### 8.3 Components (from reference classes)
Figma-derived screens: header wordmark (`.fx-head`, `.fx-word`), count pills (`.fx-pill`), dark record hero with team glow (`.fx-hero`), record cards (`.fx-rc`), section headers (`.fx-sh`), engraved stamp seals (`.fx-stamp`, `seal()`), superlatives card list with chips (`.fx-list`, `.fx-li`, `.fx-chip`), search and segmented control (`.fx-search`, `.fx-seg`), game card rows with thumbnail and filled result circle (`.fx-row`, `.fx-th`, `.fx-res`), live and lock pills (`.fx-live`, `.fx-lock`), circular team badges (`.fx-bd`), win probability bar (`.fx-wp`), root buttons with selected and dimmed states (`.fx-root`), storyline cards (`.fx-story`). Earlier screens: pill filter (`.pill`), hero record card (`.hero`), record tile button (`.tile`), stamp (`stamp()` SVG with TextPath ring label, dashed inner ring, stadium shape, year), list row (`.li`), result circle and score circle (`.circ` with w/l/t/n and s-hi/s-mid/s-lo), stadium thumbnail (`.thumb`), avatar stack (`.avs`), search field, segmented control (`.seg`) with badge, lock pill, live label with pulsing dot, ticket card (`.ticket`), timeline (`.tl`), venue hero (`.vhero`), profile header with ringed photo and team chips, stats row, navigation row with facepile, slide-over panel (`.panel`), friend row (`.fr`), rivalry card, overlap card, scorebug, story player, win probability chart, photo grid with add tile, tab bar.

All SVG (icons, engraved stadium seals from `seal()`, team badges (`.fx-bd`, used on Pick a side and the Relive scorebug), stadium shapes, game thumbnails from `thumb()`, chart) is rendered with `react-native-svg`, porting geometry verbatim from the reference.

### 8.4 Icons
The reference sprite (`#i-passport`, `#i-ticket`, `#i-route`, `#i-user`, and the rest) is the complete v1 icon set. Port each symbol to a typed React component with identical paths, 24×24 viewBox, stroke 1.9, round caps and joins, `currentColor`. New icons must be drawn in the same style. No emojis, no third-party icon fonts.

### 8.5 Stadium shapes
The reference shapes (used inside seals and thumbnails) are stylized placeholders keyed by venue type (`ballparkA`, `dodger`, `wrigley`, `oracle`, `bowl`, `canopy`, `colonnade`). v1 ships those placeholders mapped to venues. A later task traces real footprints from OpenStreetMap stadium polygons (ODbL, attribution required), simplifies them to a 64×64 viewBox with a consistent stroke style, and stores them in `venue_shapes`.

### 8.6 Avatars
Users upload a profile photo (cropped circle). Until they do, show a generated default avatar in the reference's style. Wherever a person appears (friend rows, avatar stacks, facepiles, profile), use their photo, ringed in their primary team's color where the reference shows a ring.

### 8.7 Navigation
Tab bar: **Passport**, **Games**, **Plan**, **Profile**. The active tab uses the current screen's team accent.
- Passport → record game log (slide-over), stamps, superlatives, players seen, moments.
- Games → game detail → Relive; check-in → Pick a side; imports inbox.
- Plan → game-day plan (demo shell behind `FEATURE_PLAN` in v1).
- Profile → Friends (slide-over panel with With, Following, Rivals segments), Goals, Map, Wrapped, Settings.
- Stadium guide opens from a venue or stamp (demo shell behind `FEATURE_GUIDE` in v1).

### 8.8 Screens
Screens recreated from the Figma design:
1. **Passport:** Jinx wordmark with a small "Fan passport" label; notifications and profile buttons. Team pills (All teams plus each favorite team) with game counts; selecting one filters the whole screen to that team, as in the reference. Dark lifetime record hero: label, games attended badge, large record, win rate, current streak, and a Last Game row that opens that game. Three record cards: in All teams, each favorite team plus Neutral; in a team view, Home, Road, and a companion or Playoffs card. Each card shows the record and percentage in the team's color and opens its game log. Stadium stamps row with a View All count. Fan superlatives as a card list: small label, large value, context chip.
2. **Games:** title with add button; search; History, Upcoming, Imports segments; card rows with a thumbnail (stadium art until the user adds a photo from that game), matchup and score with verified badge, venue and date (or the neutral pick for neutral games), companion avatars with names, and a filled W/L circle. Rows open game detail and Relive.
3. **Pick a side:** Live pill, "At {venue}", amber "Locks in" countdown pill; title and explainer; circular team badges (initials, team-color fill and ring) with names and records around "vs"; win probability bar in both teams' colors with percentages; two full-width "Root for {team}" buttons in team colors that toggle and confirm as in the reference; Storylines cards with source labels.

Earlier concept screens (build exactly as in the reference; a later design pass will restyle them):
4. **Relive:** as specified in 6.19.
5. **Game day (Plan):** ticket card in the rooting team's colors with seat details; companions; timeline with icons. Demo shell in v1.
6. **Stadium guide:** venue hero with shape and friends visited; Food, Bathrooms, Seats segments; ranked rows with score circles. Demo shell in v1.
7. **Profile:** handle and settings; ringed photo, name, tagline, team chips; stats (Games, Stadiums, Followers, Following); rows for Friends (with facepile), goals, Map, Wrapped.
8. **Friends panel:** back button, search, segments; companion records list with photos ringed in team color; rivalry card with crossed-swords icon; before-you-connected card.
9. **Record game log:** slide-over from any record card, as in the reference.

The welcome screen has its own reference file, `design/welcome-reference.html`, which is its visual source of truth in the same way; where it and this document disagree visually, the reference wins:
10. **Welcome:** a dark sign-in screen with a wall of Jinx objects drifting behind it. Three columns, tilted 7 degrees and oversize so no edge shows, scroll at different speeds and directions (34s up, 44s down, 26s up) behind a gradient scrim; in front, the JINX wordmark, the headline "48 games. 14 stadiums. One record." whose numbers count up on mount and every 9s, "You were there. Prove it.", Apple's own Sign in with Apple button (white, 14pt corners), "Continue with email" under it when the build offers email sign-in, and the age line. The wall holds 23 cards drawn twice per column: six game cards, brass and silver seals with a gold sheen on brass, ticket stubs, moment cards that pulse, a photo, companion records, a pledge, the live card with its pulsing dot, the streak, a ghost stamp and a Wrapped card. Every card but the six games is fixed copy. The six games come from the weekly `welcome_wall_cards` pick (4.5) through the public, unauthenticated `GET /welcome-wall` Edge Function, cached at the CDN for six hours; the app fetches it in the background at most every six hours, validates it, caches it, and draws the cached set on the next launch, falling back to the six bundled reference games when there is no cache, the cache is malformed, or it is older than 14 days. Team colours resolve locally from the palette seed by `provider:provider_team_id`, never from the payload. Motion runs on the UI thread and only on `transform` and opacity; Reduce Motion stops every loop and shows the counters' final values; a debug flag (`EXPO_PUBLIC_WELCOME_FROZEN`, and always under the parity harness) forces the bundled set and holds every loop at phase zero so screenshots are byte-comparable. The wall is hidden from VoiceOver; the headline, buttons and age line read in that order. The screen is dark in both appearances.

Screens not in the reference (onboarding, game detail, check-in flow, imports review, map, goals, bucket lists, Wrapped, settings, other users' profiles) must be composed only from the components and tokens above, preferring the Figma-derived components, so they look native to the same design. Onboarding content is unchanged from revision 1: sign in, handle, favorite teams, home city, add past games, permissions requested in context.

### 8.9 Demo mode
A `DEMO=1` build flag loads a fixture account that reproduces every piece of sample data in the reference exactly (Dean Yao, 31–17, Phillies 12–5, Eagles 6–2, 10–9 as a neutral, the stamps, games, storylines, Relive steps, friends, and so on). Demo mode exists so visual parity can be verified screen by screen, and so the Plan and Guide shells have content.

---

## 9. Privacy and safety

- Profiles public by default; private accounts require follow approval and hide attendances, records, and feed events from non-followers.
- Seat info private by default; opt-in to show on game detail to mutuals.
- Overlap and rivalries: mutual follows only.
- Never store raw location coordinates. Location is requested only at check-in.
- Ticket images private, auto-deleted (7.2). Parsed fields retained.
- Game photos default to followers-only; public items appear in "From fans at this game" only for public accounts.
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
- Sign in with Apple as the only sign-in for now. Email one-time codes come later through Resend. Do not add Google or other social logins without also keeping Sign in with Apple.
- App Review can sign in with their own Apple ID, so no demo account is required; still provide review notes explaining check-in needs a stadium location and how to try demo mode.
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
First, run the access check in `docs/ACCOUNTS.md` and report results; stop if anything fails. Monorepo (`apps/mobile`, `supabase/`, `packages/core`, `ingest/`). Expo app with expo-router, TypeScript strict, ESLint, Prettier, theme tokens (light and dark). Supabase project, local dev with Supabase CLI, migration pipeline, CI running tests. EAS project configured.
*Done when:* app boots to a placeholder tab bar in the simulator, CI is green, `supabase db reset` works.

**M0.5. Design system and UI parity (demo mode)**
Port tokens, fonts (static Archivo instances), icons, stamp seals, team badges, and every component in 8.3. Build every screen, slide-over panel, and interaction in the reference against demo fixtures behind a data repository interface. Build the visual parity harness (see the Claude Code prompt) and iterate until each screen matches the reference in light and dark mode.
*Done when:* side-by-side screenshots of all screens in both themes are approved by Dean.

**M1. Reference data and ingestion**
Schema 5.1 plus `detail_queue`. Venue and team seeds with aliases. MLB adapter (schedule, game detail, appearances, scoring timeline, weather, duration) with fixtures. NFL GitHub Action (schedules, results, pbp timeline, appearances). Historical backfill scripts (resumable). Scheduled sync jobs. Elo computation and frozen pregame win probabilities. Moment detectors.
*Done when:* every MLB and NFL game 2000–present exists with schedule and final score; queuing 20 known games (10 MLB, 10 NFL, including a known walk-off, an extra-innings game, and an overtime game) produces correct appearances, scoring timelines, win probability timelines, and moments; Elo backtest log loss is printed and parameters recorded; database size after backfill is reported and under 150 MB.

**M2. Auth, onboarding, manual logging**
Schema 5.2 (profiles, user_teams, attendances, people, companions). Sign in with Apple (email one-time codes deferred until Resend and a domain are set up; design auth so adding an email provider needs no schema changes). Onboarding flow. Manual search and log sheet. Bulk mode. Game detail. RLS policies with tests.
*Done when:* a new user can sign up, pick teams, log 10 past games including a doubleheader, see them in History, and cannot read another user's private data (tested).

**M3. Passport**
Rooting side logic, records (overall, team), win rate, stamps, superlatives, players seen, moments witnessed. Stats cache and recompute triggers. Passport screen and detail screens per mockup.
*Done when:* core rules in Section 6.1–6.2 and 6.7–6.9 have unit tests for all listed edge cases (ties, postponed games, neutral games, both favorites, relocated franchises), and the passport renders correctly for a seeded test user with 50 games.

**M4. Ticket imports**
Screenshot and PDF upload, parse-ticket function, zod validation, matcher with fixture tests, imports inbox and review UI. Inbound email (Resend inbound or the Cloudflare fallback), inbound-email function, sender allow-list, forwarding address UI, future "Going" games. If the domain isn't set up yet when M4 starts, build and test everything against a local fake inbound webhook and keep the feature flag off; ship screenshot import first.
*Done when:* 30-fixture matcher suite passes; a real forwarded confirmation and a real screenshot each produce a verified attendance end to end; images auto-delete.

**M5. Check-in, pick a side, storylines**
Geofenced check-in, verification badge, Pick a side screen wired to real data, storylines pipeline (6.18), MLB live polling with lock detection, NFL estimated lock, provisional pledges, post-final validation, pledge record and vs expected, notifications.
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

**M8.5. Relive**
Win probability timeline ingestion, story step generation, Relive screen wired to real data, photo and video upload with visibility, fans-at-this-game feed with privacy and block rules, official highlights link.
*Done when:* Relive plays correctly for 5 real MLB and 5 real NFL games, including an extra-innings game and an overtime game.

**M9. Share cards and Wrapped**
All share card templates. Wrapped generation job, storage, swipeable UI, per-card sharing.
*Done when:* share cards render correctly in light and dark on small and large iPhones; Wrapped generates for a seeded user for MLB 2026.

**M10. TestFlight hardening**
Account deletion and data export, settings completeness, attributions, empty and error states for every screen, offline handling (cached passport readable offline), performance pass (passport loads under 1s from cache), crash reporting (Sentry free tier or Expo equivalent), App Store privacy details, external TestFlight group.
*Done when:* a friend with no context can install via TestFlight, onboard, import tickets, and check in at a game without help.

---

## 13. Later phases (roadmap)

Specify each fully before building. Summaries capture intent.

**Game-day planner.** (UI shell exists from M0.5.) Upload or select a ticket and answer a few questions (tailgate, meetup, post-game, driving or transit, who's coming) to generate an itinerary: when to leave, parking or transit, which gate to enter, tailgate spot, post-game spot. Venue logistics (gates, lots, tailgate areas) don't exist in any API and must be curated, so launch for a handful of stadiums first. Wires up the Plan tab.

**Stadium guide.** (UI shell exists from M0.5.) Interactive per-venue guide: Beli-style ranked food, bathrooms (cleanliness, wait), shortest lines, seat views. Ratings only from users who logged a game at that venue.

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
1. App Store listing name if "Jinx" alone is unavailable.
1b. Whether to license official team logos later to replace the initials badges.
1c. Fourth tab is Plan (decided).
1d. Game row thumbnails: the user's own photo from that game if one exists, otherwise the generated stadium thumbnail. No stock or scraped stadium photos.
2. Whether historical favorites should be time-aware (6.1.4) once users ask for it.
3. Default geofence radius per venue type after first real-world tests.
4. How long to keep ticket images (default 7 days).
5. Whether "Going" entries for future games should appear in the feed.
6. Commercial data plan before any public App Store release.
