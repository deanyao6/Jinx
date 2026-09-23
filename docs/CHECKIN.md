# Check-in: how a fan gets to the button, and the path not shipped

Social v2, prompt 3 (docs/prompts/social/03_reactions.md, section 1). Written 2026-09-23.

A reaction only exists inside an open check-in session, so the session is the thing everything
in reactions hangs off. `checkins` is the session (00_repo_reality.md R4: extended, not forked):
`started_at`, `ended_at`, `end_reason`, `attendance_id`, `visibility`, `prompts_muted`.

## Starting a session

The fan taps Check in. The app takes one foreground location reading and the server compares
the distance to the venue's geofence (plus the reported accuracy, capped at 200 m) inside the
window from three hours before the scheduled start to an hour after the final (`check_in`,
migration 20260915000600, unchanged). Coordinates are never sent: only the distance and the
accuracy. A session creates the attendance, marked verified, editable and deletable afterwards.

Three ways a fan is led to the button, none of which needs background location:

1. **The 30-minute reminder.** A local notification 30 minutes before the start of every game
   the fan marked Going, scheduled on the device by `features/reactions/reminders.ts` whenever
   the app runs (`SessionRuntime`), reconciled against the games that still want one. Works
   offline; asks for nothing beyond the notification permission the app already asks for.
   A tap lands on the check-in screen (`game_day` routes there).
2. **App-open detection.** On the Games tab, `GamesSessionCards` offers check-in for a game
   today at the venue (`CheckInOffer`). For a favorite's game it takes one location reading,
   only if the phone already allows it, and offers the button only when the reading is inside
   the geofence. It never asks for the permission.
3. **Ticket-armed.** A matched ticket for today, or a logged game today, is offered on the
   app open without any location at all.

The Feed tab is prompt 2's; the same `GamesSessionCards` can be mounted at its top when that
screen exists.

## What a session does

- Creates the attendance, verified.
- Opens the pick window at a neutral game (Pick a side needs an open session).
- Arms reaction prompts: the server (`mlb-live`) for MLB, the checked-in phone for the NBA,
  MLS and NFL (`features/reactions/useReactionEngine.ts`).
- Presence: `also_here(game_id)` lists mutual follows with an open session who allow it
  (`visibility = 'mutuals'`, defaulted from the profile switch "Show that I am checked in"),
  with their section when they share seats. Never a location, only "here".

## Ending a session

Whichever comes first (`close_stale_checkins()`, pg_cron every five minutes, plain SQL):

| End | Reason | Who |
|---|---|---|
| The final plus 30 minutes | `final` | the server, from `games.final_at` |
| "I have left the game" | `left` | the fan, `end_checkin(game_id)` |
| Six hours after the start with no final | `timeout` | the server |
| Leaving the geofence | `geofence_exit` | nobody yet: see below |

On end: prompts stop (`fire_reaction_prompt` only reaches open sessions), the Games card goes,
and the check-in screen offers the post-game write-up (the log sheet today; prompt 2's composer
when it lands) and Relive.

## The fourth path, designed and not shipped: "Check me in automatically"

Opt-in background region monitoring. Offered only after a fan has attended three games, from
Settings, and only then does the app ask for Always location.

**Regions.** iOS monitors at most 20 regions per app. Register, in this order until the cap:
venues with an upcoming ticket or Going game in the next 14 days; then the home venues of the
fan's favorite teams; then venues within 50 miles of the fan's home city. Re-register on every
launch and when the list changes. Region radius is the venue's geofence plus 100 m.

**On entry.** Wake, take one reading, and if a game at that venue is inside its check-in window,
call `check_in` exactly as a tap would. A local notification says "Checked in at Citizens Bank
Park" with a "Not here" action that calls `end_checkin` and skips that game for the rest of the
day. Nothing is stored about the entry but the check-in row itself.

**On exit.** End the session with `geofence_exit` after five minutes outside the region (a
concourse walk or a parking lot should not end it), and never inside the first 30 minutes of a
session (arriving early and stepping out for a bite).

**What it needs that does not exist.** `expo-location`'s geofencing task
(`startGeofencingAsync`), a background task registration, the `NSLocationAlwaysAndWhenInUseUsageDescription`
string and the `location` background mode in `app.json`, an App Review justification, and a
settings switch backed by a profile column. None of that is in the app, and
`isIosBackgroundLocationEnabled` stays `false` in `app.json`: no background location permission
is requested anywhere in the app today.
