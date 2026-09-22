# Search improvements for Jinx

Design proposal, 2026-09-22. The first implementation is on `search-improvements`;
see [implementation and verification](evidence/search/README.md) for shipped behavior,
test results and deferred enhancements. Hosted search remains unchanged.

## Outcome

A fan should be able to find the game they remember using a team, opponent, stadium,
or date, even with a minor spelling error. The app should explain ambiguous interpretations
and make it clear whether it is searching the fan's own games or the full catalog.

Examples of intended behavior, subject to data being present:

| Input | Interpretation / result |
| --- | --- |
| `philies 2025` | Phillies games in calendar year 2025, with a visible correction |
| `LAFC Galaxy 2025` | Games between those two distinct teams in 2025 |
| `LA Galaxy` | One team, recognized as a phrase |
| `Giants` | Suggestions for the MLB and NFL teams, each labeled by league and city |
| `Eagles at Cowboys` | Eagles away, Cowboys home; neutral-site games still use designated sides |
| `LAFC vs Galaxy` | Either home/away ordering |
| `Staples Center 2021` | Games at the venue resolved through its historical alias |
| `Montréal` or `Montreal` | The same accented/unaccented team candidates |
| `Lakers January 2026` | January 2026 games, even when the NBA season starts in 2025 |
| `NBA 2025 season` | The NBA season keyed by 2025, explicitly labeled 2025–26 |

Historical-name lookup requires a correct alias-to-venue mapping. Search does not repair
duplicate physical venue records or invent missing games.

## 1. Search experience

- Keep the Games tab's normal History / Upcoming / Imports browsing behavior.
- Opening search exposes a clear **My games / All games** scope. Games tab entry defaults
  to My games; **+ → Log a game** defaults to All games on the same search screen.
- Preserve the query when switching scope. All games includes logged games with a Logged
  badge; tapping one opens its detail. Unlogged games open the existing logging flow.
- My games covers the user's logged games and retains companion-name and displayed-score
  searching. It must not lose functionality when the new engine replaces substring search.
  Companion data stays in an owner-restricted lookup, never the shared catalog index.
- Render team and venue suggestions in separate labeled groups; show league, city and
  historical name context where useful. Begin prefix suggestions at two characters.
- Display confidently recognized teams, league and dates as removable filter chips.
  Suggest interpretations of ambiguous text without silently choosing one.
- If My games has no matches, offer **Search all games** with the same query. Do not
  automatically change scope or disguise a failed request as an empty result.
- Use 25 results per page and a Load more control initially. Show “25 results loaded,”
  not a total count unless an actual total is available.
- Keep a 300 ms debounce. Cache by query, scope, owner, filters and ranking version;
  distinguish in-flight results from results for the current query. Cancel obsolete
  requests where supported and prevent late responses from replacing newer results.

## 2. Query interpretation

Resolve small team/venue alias catalogs first, then query games using entity IDs. Avoid
running fuzzy comparisons against every game row or flattening all game metadata into
one giant string.

### Normalization and phrases

Normalize case, Unicode accents, punctuation and whitespace consistently for indexed aliases
and incoming queries. Preserve the original text for display. Handle punctuation such as
`D.C.` through normalized aliases without erasing meaningful matchup separators.

Extract structured dates, league names and separators before resolving the remaining text.
Prefer longer exact phrases: `LA Galaxy` is one entity, not two unrelated tokens. Preserve
`vs`, `at` and `@` until the matchup has been understood. Drop filler words only afterwards.

Consider bounded alternative interpretations for overlapping phrases rather than greedily
locking in the first matching alias. Every meaningful query span must be accounted for.
Keep unresolved terms visible; do not silently discard them to manufacture results.

### Matching tiers

1. Exact normalized name, abbreviation or curated alias.
2. Prefix match for incomplete typing.
3. Conservative fuzzy match using PostgreSQL `pg_trgm` similarity.

Deduplicate aliases into entity candidates before applying suggestion limits, using the best
matching alias for each entity. A club with many aliases should not gain a ranking advantage.
Maintain bounded candidates per phrase and a total candidate budget, tuned through fixtures
and query-plan measurements. Exceeding ambiguity limits should prompt a narrower selection.

Do not fuzzy-match numbers, dates or one/two-character abbreviations. For longer text,
calibrate thresholds against real query fixtures; do not treat a raw similarity score as a
probability that the interpretation is correct. Prefer exact interpretations and only offer
fuzzy alternatives when appropriate. Never replace a valid exact team with a different team
simply because the exact query returned no games.

A correction such as `philies` → Phillies is visible and reversible. If two candidates are
plausible, present choices. For `Giants`, selecting MLB resolves the ambiguity; favorites may
break suggestion ties but must not hide the NFL option or override explicit text.

### Matchups and constraints

Two resolved teams must be distinct and occupy opposite sides of the same game. An alias
of one team cannot satisfy both slots. Two different teams resolve to a matchup in either
order unless `at`/`@` specifies away/home. A same-team matchup is an invalid interpretation.

Selected league, team, venue and date filters are hard constraints. On no results, suggest
an explicit edit or removal. Never quietly broaden the date range, drop an opponent or
ignore a league to fill the screen. Conflicting text and chips should produce an explanation
and an editable choice rather than one silently overriding the other.

### Dates and seasons

For v2, a plain year means **calendar year**, evaluated in the venue's local timezone.
An explicit season filter or `season` phrase means the sport's season key. Label that
distinction in chips. This intentionally replaces v1's ambiguous year-or-season behavior;
keep the legacy endpoint unchanged during migration and test the changed semantics.

Initially support years, ISO dates, and English month plus year (`September 2025`).
Numeric dates such as `03/04/2025` need a date picker or explicit interpretation rather
than a silent locale guess. Validate impossible dates and reversed ranges. Use the existing
fallback for unknown venue timezones, documenting that those dates can remain imperfect.

Defer phrases such as `last summer`, holiday names and arbitrary prose. A later relative-date
parser must use an explicit reference date/timezone and show the resulting range. Season
labels must support the sport's actual model; search must not invent MLS 2027+ season mappings.

## 3. Ranking

Separate eligibility from ordering. A plausible interpretation must satisfy every required
entity/date constraint before its games can be ranked.

Use ordered match tiers rather than a single opaque weighted score:

1. All entities match exact names/aliases.
2. All entities match exactly or by prefix.
3. At least one entity requires a disclosed fuzzy correction.

Within a tier, prefer stronger phrase coverage and entity similarity. A fuzzy match never
outranks an exact match merely because the game is newer. A user-selected entity ID is
authoritative; do not keep penalizing its results for the original misspelling.

Once the query resolves to the same entities and dates, dates are the sensible tie-breaker.
Offer **Best match / Newest / Oldest**. Best match orders by match tier/quality, then newest,
then game UUID for determinism. Explicit Newest/Oldest orders eligible results by date/UUID.
An optional Upcoming filter sorts soonest first; future schedules should not dominate a
past-game logging search unintentionally. Decide the logging entry's initial time filter
in UI review and display it visibly.

Return concise match reasons, such as “Matched Phillies from ‘philies’” or “Formerly Staples
Center.” Do not display arbitrary similarity percentages as confidence.

## 4. Database and API design

- Add a new forward migration for `pg_trgm`, normalized alias search fields and appropriate
  indexes. Confirm the extension schema and qualify functions/operators as needed.
- Keep normalized alias values synchronized on insert/update; use one tested normalization
  policy. Do not declare accent-removal expressions immutable just to satisfy an index.
- Use trigram indexes for bounded fuzzy alias lookup and prefix-friendly indexes for exact
  and prefix searches. Retain indexed game joins on team IDs, venue IDs and scheduled time.
  Validate actual plans rather than assuming an index will be selected.
- Add a versioned RPC such as `search_games_v2`; leave `search_games`, `search_teams` and
  `search_venues` available for existing clients. Factor shared entity resolution so
  autocomplete and submitted search use consistent rules.
- Inputs: raw query, explicit scope, structured filters, sort, page size and cursor.
  Derive the owner from `auth.uid()` for My games; never trust a client-supplied owner ID.
- Outputs: interpretation status, resolved filters, ambiguities/corrections, result rows,
  match reasons and next cursor. Include the MLS decision method and separate shootout
  scores so search rows cannot misrepresent penalty results.
- Use keyset pagination with the complete deterministic sort tuple, including UUID.
  Bind cursors to normalized query/filters/scope/sort and ranking version; reject stale or
  mismatched cursors. Freeze relative-date interpretation for the search session.
  Live catalog edits can still change results; a refresh restarts pagination.
- Use `SECURITY INVOKER` and existing RLS. Query-specific interpretation must not grant
  access to someone else's attendance, companions or private metadata.
- Bound query length, token count, candidate expansion and page size. Parameterize all
  queries and escape LIKE metacharacters so user-entered `%` and `_` are literal text.

PostgreSQL supports indexed trigram similarity and full-text ranking:
[pg_trgm](https://www.postgresql.org/docs/17/pgtrgm.html),
[text-search functions](https://www.postgresql.org/docs/15/functions-textsearch.html).
This proposal primarily uses entity resolution and structured joins. Full-text search may
help future narrative fields, but does not by itself solve ambiguous teams, dates or matchups.

## 5. Verification and acceptance

Create a fixture-based search evaluation set before tuning ranking. Record expected entity
interpretations and relevant game IDs, not just whether any rows were returned.

- Exact names, aliases, prefixes, accents, punctuation and common misspellings across
  MLB/NFL/NBA/MLS; ambiguous Giants/Cardinals names and short abbreviations.
- Longest phrases, repeated aliases for one team, opposite-team assignment, reversed
  `vs` order, and directional `at`/`@` matchups.
- Multiple leagues sharing a venue; renamed venues; duplicate aliases pointing at different
  venues; no invented reconciliation of unresolved venue records.
- Venue-local midnight, timezone fallbacks, NBA calendar year versus season, leap days,
  invalid dates, and queries that conflict with explicit filters.
- MLS draws, single-match shootouts and aggregate shootouts rendered correctly.
- Exact-match priority over fuzzy matches; visible corrections; unknown terms remain visible;
  no silent filter relaxation on zero results.
- Pagination with equal ranks/timestamps: no duplicates or missing rows on a fixed dataset;
  changes of query/scope/sort invalidate cursors.
- RLS for anonymous access, two different users, own attendances and companion names.
- Mobile tests for scope switching, suggestions, chips, loading/errors, stale responses,
  Load more, and routing logged versus unlogged results.

Proposed performance targets, to validate on representative hosted-size data: server p95
under 250 ms for common searches and under 500 ms for bounded fuzzy searches. Measure cold
and warm requests separately; these are targets, not current guarantees. Track top-5 success
on the curated query set, false corrections, zero-result rate, latency and time to selection.
Prefer aggregate diagnostics without collecting raw personal search strings by default.

## 6. Delivery sequence

1. **Contract and fixtures:** settle scope/date/sort behavior, define the RPC response,
   capture baseline queries and performance, and establish acceptance fixtures.
2. **Backend:** normalized alias lookup, conservative fuzzy candidates, phrase/matchup
   resolution, simple dates, ranking and keyset pagination; SQL tests and EXPLAIN analysis.
3. **App:** shared search screen, explicit scopes, grouped autocomplete, editable filters,
   correction copy and paging. Preserve existing logging/detail routes and personal search.
4. **Rollout:** migrate locally, test with representative data, deploy the additive endpoint,
   verify authenticated hosted queries, then enable the new screen behind an app flag.
   Rollback switches the app to v1; no destructive migration or game re-import is required.
5. **Later:** richer relative dates and optional personalization, guided by measured failures.

Start search implementation on a dedicated branch based on the MLS work. Commit/deploy it
separately from the completed MLS rollout. No separate search service or language-model
dependency is proposed for the first release.
