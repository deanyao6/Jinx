# MLS local rollout evidence (2026-09-21)

Not a hosted or TestFlight deployment. No reset, user attendance creation, commit or push.

## Import

`node scripts/mls-local.mjs --from 2016 --to 2026`, followed by a full `--force` rerun.
Database queries, not monthly log sums (rescheduled IDs can appear in more than one month):

| Season | Total | Regular finals | Playoff finals | Scheduled | Cancelled | Postponed |
|---|---:|---:|---:|---:|---:|---:|
| 2016 | 357 | 340 | 17 | 0 | 0 | 0 |
| 2017 | 391 | 374 | 17 | 0 | 0 | 0 |
| 2018 | 408 | 391 | 17 | 0 | 0 | 0 |
| 2019 | 421 | 408 | 13 | 0 | 0 | 0 |
| 2020 | 319 | 292 | 17 | 0 | 7 | 3 |
| 2021 | 472 | 459 | 13 | 0 | 0 | 0 |
| 2022 | 489 | 476 | 13 | 0 | 0 | 0 |
| 2023 | 526 | 493 | 28 | 0 | 5 | 0 |
| 2024 | 526 | 493 | 29 | 0 | 4 | 0 |
| 2025 | 543 | 510 | 30 | 0 | 3 | 0 |
| 2026 | 510 | 387 | 0 | 123 | 0 | 0 |

Total: 4,962. Current-year counts are a snapshot, not a completed season.
`pg_database_size(current_database())` rounded to 28 MB after initial import and 30 MB after reruns.
This local database is smaller than the prior machine described in STATE.md: 2,881 MLB,
7,289 NFL, no NBA, plus MLS. Do not infer deletion; no reset was run here.

Idempotency: captured MD5 of sorted `(provider_game_id,id)` for every MLS game and sorted
`(attendance.id,attendance.game_id)` for all attendances before/after the full forced re-import.
`diff` found no differences. This verifies existing references; it does not prove the app journey.

## Independent checks

- [2016 Cup official recap](https://www.mlssoccer.com/news/toronto-fc-0-4-seattle-sounders-0-5-2016-mls-cup-final-recap):
  0–0 goals, Seattle wins 5–4 on penalties. Captured fixture 468711 matches.
- [2016 Colorado–LA official recap](https://www.mlssoccer.com/news/colorado-rapids-1-la-galaxy-0-3-1-pks-2016-mls-cup-playoff-match-recap):
  Colorado wins the individual match 1–0; series tied 1–1 and Colorado advances 3–1 on penalties.
  Captured fixture 468040 matches and uses `aggregate_shootout`.
- [2022 schedule format](https://www.mlssoccer.com/news/mls-announces-2022-schedule-format-conference-alignment):
  28 clubs with 34 matches each implies 476 league matches, matching the imported regular finals.
- [2025 official schedule](https://www.mlssoccer.com/news/mls-2025-regular-season-schedule-information-details):
  30 clubs playing 34 matches each implies 510 league games, matching imported regular finals.
- [Union box score](https://www.philadelphiaunion.com/news/box-score-philadelphia-union-4-toronto-fc-0):
  the 2022-10-09 Toronto visit was at Subaru Park, fixing ESPN's missing venue for 623627.
- [FC Dallas stadium contact](https://www.fcdallas.com/stadium/contact): Toyota Stadium is in
  Frisco, Texas, not the provider's erroneous city string “Toyota Stadium”.

## Open data issues

Initially 13 rows lacked venues: one played 2022 match (sourced correction added) and 12
cancelled/postponed rows. Historical venue rows have unverified locations/timezones and some
are duplicate physical stadiums under different provider IDs. These need a curated migration.
After refreshing the sourced correction, SQL confirms 12 missing venues, all non-final,
and Subaru Park on 623627. No coordinates were guessed. Venue-row coverage does not imply geofenced check-in support.

## Validation

- Aggregate-shootout migration: applied locally; 366 pgTAP assertions/20 files passed.
- Core: 332 tests passed. Ingest: 38 tests passed.
- Functions: 21 tests passed, including ticket schema and inbound-email tests.
- Final mobile: 894 tests/90 suites, 2 snapshots passed. Open-handle warning after the run;
  process subsequently exited. Typecheck, lint, functions typecheck and scoped Prettier pass.
- Final SQL: 369 assertions/21 files passed, including Toyota Stadium correction. An initial
  final-check connection timed out during simulator/concurrent test load; retry passed.
- Palette audit: 125 palettes pass, with the existing authoritative SF contrast warning.
- `git diff --check` passes. README.md and package-lock.json pre-existing edits were preserved.
- GitHub probe passed on laptop only (30 clubs; 74 September 2026 league events).
- Simulator: reached MLS league picker; full data journey and screenshots not verified.
