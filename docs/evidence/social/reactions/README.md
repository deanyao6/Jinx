# Reactions: a simulated game day on the simulator

Social v2, prompt 3 (`docs/prompts/social/03_reactions.md`, acceptance: "a recorded simulator
run of a full game: check in, scheduled prompt, one event prompt, session end, post-game
composer"). Taken 2026-09-23 on a dedicated simulator ("Jinx reactions", iPhone 17 Pro, iOS
26.5) from a development build of branch `social-v2-reactions`, Metro on port 8083, against
the local database, signed in as Dean's local account.

The day was staged in SQL: the real local game 2025_13_CHI_PHI (Bears at Eagles, Lincoln
Financial Field, which has a story) moved to "kicked off 95 minutes ago, no final", Dean and a
mutual friend checked in the way `check_in` does it, the friend sharing seats. Prompts were
fired through `fire_reaction_prompt` with the arguments the engine produces, because no NFL
game was under way and the simulator has no location or camera (the capture uses the drawn
placeholder a development build substitutes, and the front frame is the simulator's own black
test frame once camera access was granted). Everything was restored afterwards; the game is a
final again with its original times and the fixture rows are gone.

| Screen | What it shows |
|---|---|
| `games-live-session-card.png` | The Games tab while checked in: the session card in the Eagles' colours, "1 of 3 reactions used" |
| `checkin-session-panel.png` | The checked-in screen's panel: the session line, reactions of three with React now and "not tonight", Also here with the mutual's section, "I have left the game" |
| `event-prompt-banner.png` | An Eagles touchdown fired at `audience = home`: the banner reaches the Eagles fan (the Rams-neutral friend was skipped, `no_side`) |
| `capture-countdown.png` | The three-second countdown, "Get ready for the selfie", the lateness line |
| `capture-stitched-preview.png` | The stitched preview: field with the selfie inset, "late by 3 min", Retake, Post reaction, Only me |
| `capture-posted-late.png` | Posted. One `reactions` row and one `posts` row of kind `reaction`; `late_seconds` is the server's |
| `scheduled-prompt-banner.png` | The scheduled prompt, copy from the (up, favorite) template: "Philadelphia Eagles up 3 with 8 minutes left. How are you holding up?"; the panel reads 2 of 3 |
| `self-trigger-only-me.png` | A self-triggered reaction saved with Only me: private, no post, not counted against the prompts |
| `game-page-reaction-strip.png` | The strip under the score on the game page, with the prompt's label and the caption |
| `relive-reactions-at-final-step.png` | Relive's final step: "2 reactions at this moment", pinned by `pin_reactions` |
| `session-ended-postgame-offer.png` | The session ended (the cron closed it 30 minutes after a final): the post-game offer, Write it up and Relive it |
| `games-after-leaving-checkin-offer.png` | After "I have left": the live card is gone and today's logged game is offered for check-in again |
| `probe-espn-nfl-from-device-build.png` | The live feed probe from the build: ESPN's NFL scoreboard answers, Giants at Rams parses as a Q4 final 6-28, today's board has nothing under way |
| `privacy-switches.png` | "Show that I am checked in" and "Reaction prompts" on the Privacy screen |
| `notification-settings-reaction-prompts.png` | The reaction prompt notification kind, individually toggleable |

Found by this run and fixed before it was recorded: an insert into `posts` with a RETURNING
clause is refused under RLS because `can_view_post` reads `posts` with the statement's own
snapshot, so the client now mints the ids and inserts without one; `pin_reactions` referenced
its target table from a lateral join and could not run; a failed post no longer leaves a
reaction behind.
