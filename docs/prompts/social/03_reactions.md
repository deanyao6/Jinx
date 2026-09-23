# Prompt 3: reactions, the BeReal mechanic for live games

> **Read [`00_repo_reality.md`](00_repo_reality.md) first.** It lists every place this brief
> disagrees with the repo as it stands, and how to resolve each one. Where the two conflict,
> `00_repo_reality.md` wins unless Dean says otherwise. Section 3 of this brief (the paid NFL
> feed) is overruled there: **do not buy a data feed.**

Depends on prompts 1 and 2. In `design/prototype.html`, press **Simulate reaction prompt** and walk the capture flow, then open Relive to see where a reaction lands.

This is the app's most original feature. The design principle: **ask for five seconds of phone time, never more.** No live chat, no feed to scroll at the game.

## 1. Check-in sessions, the thing everything here depends on

A reaction only exists inside an open check-in session, so build sessions first.

**Starting a session.** The user taps Check in and the app takes one foreground location reading. Success requires being within the venue radius (plus reported accuracy, capped at +200m) during the window from 3 hours before scheduled start to 1 hour after final.

Three ways a user is led there, none of which need background location:
1. **Scheduled local notification** 30 minutes before first pitch for any game they marked Going or that came from a forwarded ticket. Scheduled on device, works offline, no new permissions.
2. **App-open detection.** Any time the app opens inside a venue geofence during a game window, show a check-in banner at the top of Games and Feed.
3. **Ticket-armed.** A matched ticket for today plus an app open is enough to offer check-in without waiting for location.

Design a fourth path but **do not ship it yet**: opt-in background region monitoring ("Check me in automatically"), offered only after a user has attended three games, requiring Always location. iOS caps monitored regions, so register only venues near home plus venues with an upcoming ticket. Put the design in `docs/CHECKIN.md`.

**What a session does.**
- **Creates the attendance automatically**, marked verified, owned by the user, editable and deletable afterwards. Nobody should have to log a game they checked into.
- Opens the pick window at neutral games, arms reaction prompts, and starts the Live Activity.
- **Presence:** other checked-in users appear in an "Also here" list. Default visibility is **mutual friends only**, with an off switch in settings, and never precise location, only "here" plus optional section if they shared a seat.

**Ending a session,** whichever comes first: final plus 30 minutes; an explicit "I've left"; 6 hours after start with no final; geofence exit if background monitoring is ever enabled. On end: Live Activity dismissed, prompts stop, post-game composer offered.

**Offline:** check-in works against a cached venue list and syncs later. Stadium cell service is bad, so every live feature degrades to a single post-game prompt rather than failing loudly.

## 2. When a prompt fires

Three per game maximum, and they are not interchangeable.

### 2a. The scheduled check-in reaction, exactly one per game, always late

This is the BeReal moment. It fires **late in the game, when the result is in the balance**, not at a random time:

- **MLB:** between the start of the 7th and the end of the 8th.
- **NFL:** in the 4th quarter, before the two-minute warning.
- **Soccer:** from the 70th minute.
- A blowout (win probability above 92% either way) pushes it earlier in the window rather than skipping it, so people still get their one prompt.

**The copy is team-aware and situation-aware**, built from the live state plus the user's rooting side:

- "Phillies are down 2 heading into the 8th. Let's hope they tie it. Let's see your reaction."
- "Eagles up 6 with 9 minutes left. How are you holding up?"
- "Tied in the 8th at a neutral game, you picked the Dodgers. React."

Generate from a small template set keyed on (score margin bucket, period, rooting side), never free-form. Write the templates in one file so they can be edited without code changes.

### 2b. Up to two event reactions, big moments only

The bar is high on purpose. An event prompt fires only if the play clears **both** a type whitelist and a significance threshold.

**MLB, allowed:** multi-run home run (2+ RBI), grand slam, go-ahead or tying home run in the 7th or later, walk-off anything, completed no-hitter or perfect game, no-hitter through 8, triple play, an inside-the-park home run, a 5+ run inning, and any play flagged on the curated milestone list (a record, a milestone home run, a franchise first).

**MLB, not allowed:** solo home runs (unless they are go-ahead late, a walk-off, or a milestone), RBI singles, sacrifice flies, routine scoring.

**NFL, allowed:** a touchdown of 40+ yards, a pick-six, a fumble return touchdown, a kick or punt return touchdown, a safety, a go-ahead score inside the final 5 minutes, a 55+ yard field goal, a fourth-down conversion inside two minutes that leads to a score, and milestone-list plays.

**NFL, not allowed:** field goals, short touchdowns, extra points, routine scoring drives.

**Significance gate.** On top of the whitelist, require a win-probability swing of at least 15 points, or membership on the milestone list. MLB gives win probability live; for NFL, approximate with score margin, time remaining, and yardage until play-by-play lands overnight. Store the computed `significance` on the prompt so the thresholds can be tuned from data later.

### 2c. Who gets an event prompt

**Event prompts are targeted by side.** A Barkley touchdown prompts the Eagles fans in the building, not the Rams fans watching it happen.

- `reaction_prompts.audience` is `home`, `away`, or `all`.
- Audience is the side the play **benefits**. Recipients are checked-in users whose rooting side matches: a favorite team, or a locked neutral pick for that side.
- Checked-in users with no side get nothing, except for `audience='all'`.
- `audience='all'` is reserved for events that transcend allegiance: a completed no-hitter or perfect game, a record broken, a walk-off, a game-ending play. Use it sparingly.

### 2d. Caps and spacing

- **Three prompts maximum per game: one scheduled plus up to two events.**
- The scheduled prompt's slot is **reserved**: using both event prompts early never costs the user their late-game moment.
- Minimum 12 minutes between prompts. If an event lands inside the scheduled window and no scheduled prompt has fired, merge them: the event prompt becomes the check-in prompt, and the scheduled one is cancelled.
- Two ignored prompts in a row silences the rest for that game.
- No prompts in the first 10 minutes, or after the session ends.
- **Self-triggered reactions** are always available from the checked-in screen, do not count toward the cap, and are limited to five per game.

## 3. Live data sources, by sport and budget

Build this as a `LiveMomentSource` interface with three implementations, so the feature degrades gracefully:

1. **MLB, free and detailed.** Poll the MLB Stats API live feed every 20 seconds, but only for games with at least one open check-in session. It gives play type, RBI count, inning, and win probability, which is everything the whitelist and significance gate need. Prompt copy uses the real play description.
2. **NFL, cheap and coarse.** Poll a budget scores API (roughly $19 to $39 a month) every 30 to 60 seconds for games with open sessions. Only score changes are visible live, so apply the significance gate with what you have (points scored, margin, time) and write generic copy: "Touchdown, Eagles. React now." **Then upgrade overnight:** when nflverse play-by-play lands, rewrite the label to the real play ("Saquon Barkley's 90-yard touchdown run"), recompute significance, and pin the reaction to the right moment on the win probability line. Store `label` and `label_final` separately.
   - Because live NFL data can't tell a 2-yard plunge from a 90-yard run, be conservative: during the game, only prompt on a score that swings the margin (a go-ahead or tying score) or a defensive or special-teams score if the feed exposes it. Better to miss a moment than to prompt on a chip-shot field goal.
3. **Crowd signal, free, works for any sport.** If three or more checked-in users at the same game self-trigger reactions within 90 seconds of each other, treat it as a moment and prompt everyone else checked in there, with `audience='all'` and generic copy. One crowd prompt per game, and it consumes an event slot.

Verify every API detail, rate limit, and license before building, and record findings in `docs/data-sources.md`.

## 4. The capture flow

Exactly as the prototype shows, and as Dean specified:

1. Push notification or in-app banner: "Quick, react to {label}." Tapping opens the capture screen directly (deep link `/react/[gameId]?prompt=[id]`).
2. **Back camera first.** Full-screen viewfinder, the prompt label at the top, a shutter button. The user points at the field and shoots.
3. **Three-second countdown** with the caption "Get ready for the selfie," then the front camera fires automatically.
4. Preview: the stitched result (field photo with the selfie inset, BeReal-style), with Retake, Post, and "Only me."
5. Posting creates a `reactions` row and a `posts` row of kind `reaction`, and the reaction is pinned to the game's timeline.

Details:
- Capture back-then-front sequentially. True simultaneous dual capture needs iOS multi-cam and a custom native module; do not attempt it now, and note the decision in `design/PORTING_NOTES.md`.
- The window is **2 minutes** from the prompt. Later posts are allowed but labeled "late by 4 min," which is exactly why BeReal's felt honest.
- "Only me" saves the reaction privately. It still appears in the user's own Relive and never in anyone's feed.
- Mic is never used. No video in v1.

## 5. Where a reaction lives afterwards

This is the part that makes reactions worth capturing:

- The reaction stores `wp_seq` and `period_label`, mapping it to the moment on the win probability line.
- In **Relive**, reactions render inline at the moment they were taken: the user's own always, others' when visibility and follow rules allow.
- On the **game detail** screen, a strip of that game's reactions.
- In the **feed**, immediately, as its own post.
- In a **game post**, optionally attached by the composer (prompt 2, section 1).
- Reactions from other fans at the same game appear in Relive only when the reaction is public and the author's profile is public, never for blocked users.

## 6. Notifications

- Reaction prompts are a separate notification category, individually toggleable, and default on for checked-in games only.
- Never fire when the phone reports Do Not Disturb via the system, never more than the caps above, and never for a game the user left (geofence exit or explicit "I've left").
- Copy is short and urgent, never scolding. If a user misses it, say nothing.

## 7. Privacy and safety

- Reaction photos contain strangers in the background: they are followers-only by default, with a public option, and report, block, and takedown from day one.
- Store the venue, never precise coordinates.
- A global "no reaction prompts" setting, and a per-game "not tonight."
- Deleting a reaction deletes its post, its photos in Storage, and its slot in Relive.

## 8. Acceptance

- **Sessions:** a simulated day proves check-in creates a verified attendance, presence shows only mutuals, and the session ends on final plus 30, on "I've left", and on the 6-hour timeout. No background location permission is requested anywhere in the app.
- **Scheduled prompt:** fires in the correct window for MLB, NFL and a blowout case; copy matches the (margin, period, side) template; every checked-in user gets exactly one per game even if both event slots were spent earlier.
- **Event gate:** fixture tests prove a solo home run, an RBI single, a field goal and a 2-yard touchdown do **not** prompt, while a 3-run homer, a walk-off, a pick-six, a 62-yard touchdown and a completed no-hitter do.
- **Targeting:** an Eagles touchdown prompts checked-in Eagles fans and neutral pickers of the Eagles, and nobody else; a no-hitter prompts everyone.
- **Caps:** never more than 3, never closer than 12 minutes, merge behaviour inside the late window, silence after two ignores, self-triggers uncapped up to 5 and not counted.
- **NFL upgrade path:** coarse live prompt, then overnight relabel and re-pin verified against a fixture game.
- **Crowd signal:** three simulated self-triggers prompt the rest of the venue once.
- **Capture:** back camera, 3-second countdown, selfie, stitched preview, "Only me" never enters any feed query, offline capture queues and posts late with a late label.
- Show me a recorded simulator run of a full game: check in, scheduled prompt, one event prompt, session end, post-game composer.
