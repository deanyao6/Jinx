# Search v2 implementation and verification

Implemented on `search-improvements`, updated to `main` after Dean merged MLS. Hosted search has not
been changed. The entry points remain on v1 until `EXPO_PUBLIC_SEARCH_V2=1` is set in the app build.

## Shipped in this branch

- A shared search screen with My games / All games, league and date/season/time filters,
  grouped team/venue suggestions, ambiguity choices, visible corrections and Load more.
- A shared TypeScript interpreter for calendar years, explicit seasons, ISO dates and
  month/year phrases; bounded phrase resolution, exact/prefix/fuzzy match tiers and two
  distinct teams for matchups. `at`/`@` preserves designated away/home direction.
- Additive `search_entities_v2` and `search_games_v2` RPCs. Normalized aliases, trigram and
  prefix indexes, alias synchronization triggers, calendar dates at the venue, strict
  filters, owner-restricted personal text search and deterministic cursor pagination.
- Logged results open detail; unlogged results open the existing log sheet. MLS goals and
  penalties remain separate, and search rows show the venue-local calendar date.

Interpretation happens in the shared core before calling the game RPC; it is not an LLM.
Ambiguities require a choice rather than ranking one team invisibly above another. After an
interpretation is selected, its games have the same entity relevance, so Best match orders
by date/UUID. Prefix/fuzzy relevance ranks entity interpretations and suggestions. There is
no favorite-team boost or opaque cross-game relevance score in this release.

The SQL migrations are additive and in order: `20260922000200_search_v2.sql`,
`20260922000300_search_venue_leagues.sql`, `20260922000400_search_sort_and_aliases.sql`,
`20260922000500_search_explicit_sort.sql`. The follow-ups preserve locally applied history
while correcting venue league lookup, nullable sort direction and explicit Newest ordering
with Upcoming. No reset was used.

## Evidence (2026-09-22)

- Core: **358 tests**, including 26 new parser/resolver cases.
- Mobile: **910 tests / 92 suites / 2 snapshots**, including 15 new screen/request cases.
- Database: **416 assertions / 23 files**, including 36 new transactional search assertions.
- Ingest: **38 tests**.
- Workspace typecheck, lint, formatting and Edge Function typecheck pass.
- A separate formatting-only commit cleans 22 pre-existing main-branch failures so CI can pass;
  their JSON values / emitted JavaScript were compared and are unchanged.
- Mobile emits pre-existing notification/act/open-handle warnings, then exits successfully.

Reproduce the read-only data backtest with:

```sh
node --import tsx scripts/search-backtest.mjs
```

It refuses hosted access by addressing only the named local Docker context/container, uses
read-only transactions, and requires no API keys. It compares 13 natural-language query
interpretations and ordered first pages against independently constructed SQL. The full
2025 MLS pagination traversal compares every ID, in order, with an independent SQL result:
**543 rows, no duplicates or omissions**. Ambiguity, unsupported terms and same-team matchups
are checked separately, along with AT&T Stadium and Staples Center venue aliases.
Results and EXPLAIN output are in [backtest.json](backtest.json).

The dataset has **15,132 games**: 2,881 MLB, 7,289 NFL, 4,962 MLS. It has no NBA games, so NBA
calendar-year versus season behavior is covered with transactional Lakers/Warriors fixtures.
Those fixtures and two test users are rolled back; user accounts/attendance were not modified.
The Lakers data-backtest case validates entity resolution and an empty local result only.
The September 2025 LAFC/Galaxy case intentionally returns no games, matching independent SQL.

Measured local query cases took 247–891 ms (median 420 ms), including Docker/psql startup,
two RPCs and the independent comparison query. An example fuzzy-alias EXPLAIN took 0.668 ms;
the MLS calendar-year game RPC took 6.496 ms. These are single local measurements, not hosted
p95 or cold-cache benchmarks. PostgreSQL chose a sequential scan for the small 694-alias
catalog; the trigram index exists for larger catalogs, not because every query must use it.

The upstream timezone audit assumed all venues were complete before MLS was added. Its
coverage is now explicitly MLB/NFL/NBA, with a separate assertion for the existing New York
fallback. The 38 MLS venues without timezone metadata remain a documented data gap; their
calendar-date boundaries can be inaccurate until that metadata is filled.

## Review and rollout

1. Review and merge `search-improvements` into `main`; the MLS dependency is already merged.
2. Apply all four search migrations to a test backend without resetting data.
3. Run the suites/backtest and enable `EXPO_PUBLIC_SEARCH_V2=1` for a development build
   pointing at that backend. The Games search field opens My games; + → Log a game opens
   All games. Existing v1 entry points stay available for old builds.
4. Verify on a signed-in device: choose Giants' league, search `philies 2026`, search a known
   matchup/date, switch scopes, find a companion, page results and open a game. Review both
   appearances and accessibility. Native screenshots/full device interaction have not been
   captured for this branch; component interactions are covered by automated tests.
5. Check hosted query plans/latencies and migration compatibility before enabling the flag
   in a release build. Publish the app only after the additive migrations are live.
6. Rollback: disable the app flag and rebuild/reload. Leave additive database objects in place
   so builds already using v2 continue to work; do not drop them during app rollback.

## Deliberately deferred / limits

- Relative dates (“last summer”), arbitrary natural language and personalization.
- Parsing player names, scores or companions across the public catalog. My games retains
  normalized personal text/score lookup, scoped to the authenticated owner.
- Correcting missing aliases, duplicate physical venues, absent games or unknown timezones.
- Exact total result counts and automatic infinite scrolling.
- Hosted load tests and post-release zero-result/selection metrics. No raw-query analytics added.
- The bounded resolver considers up to eight candidates per phrase and 32 paths per token;
  broad queries may require more specific text. Fuzzy similarity is a heuristic, not a probability.

The complete proposal, including later enhancements, is in [SEARCH_PLAN.md](../../SEARCH_PLAN.md).
