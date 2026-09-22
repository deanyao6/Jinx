/** Read-only backtest against the local Jinx DB; no keys or hosted access. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseSearch, resolveSearch } from '../packages/core/src/search.ts';

const literal = (v) => `'${String(v).replaceAll("'", "''")}'`;
function sql(query, authenticated = false) {
  const input = authenticated
    ? `begin read only; set local role authenticated; set local request.jwt.claim.sub='b2220000-0000-4000-8000-000000000001'; ${query}; rollback;`
    : `begin read only; ${query}; rollback;`;
  const output = execFileSync(
    'docker',
    [
      '--context',
      'colima-jinx',
      'exec',
      '-i',
      'supabase_db_name_tbd',
      'psql',
      '-XAtq',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  return JSON.parse(output.trim());
}
function rpc(name, args) {
  return sql(`select public.${name}(${args})`, true);
}
function resolve(q, filters = {}) {
  const parsed = parseSearch(q, filters);
  const entities =
    parsed.error || !parsed.phrases.length
      ? []
      : rpc(
          'search_entities_v2',
          `array[${parsed.phrases.map(literal).join(',')}]::text[],${parsed.filters.sport ? literal(parsed.filters.sport) : 'null'}`,
        );
  return { parsed, plans: resolveSearch(parsed, entities) };
}
const fixtures = [
  ['Phillies 2026', ['Philadelphia Phillies']],
  ['philies 2026', ['Philadelphia Phillies']],
  ['PHI MLB 2026', ['Philadelphia Phillies']],
  ['Eagles at Cowboys 2024', ['Philadelphia Eagles', 'Dallas Cowboys']],
  ['Cowboys vs Eagles 2024', ['Dallas Cowboys', 'Philadelphia Eagles']],
  ['LA Galaxy', ['LA Galaxy']],
  ['LAFC Galaxy 2025', ['LAFC', 'LA Galaxy']],
  ['LAFC vs Galaxy September 2025', ['LAFC', 'LA Galaxy']],
  ['Montréal MLS', ['CF Montréal']],
  ['Montreal MLS', ['CF Montréal']],
  ['Lakers January 2026', ['Los Angeles Lakers']],
  ['Giants MLB', ['San Francisco Giants']],
  ['Giants NFL', ['New York Giants']],
];
const report = {
  recordedAt: new Date().toISOString(),
  source: 'local only; read-only authenticated SQL',
  counts: sql(
    'select jsonb_object_agg(sport_id,n) from (select sport_id,count(*) n from games group by sport_id) t',
  ),
  cases: [],
  timingsMs: [],
};
for (const [query, names] of fixtures) {
  const started = performance.now();
  const { parsed, plans } = resolve(query);
  const plan = plans.find((p) => names.every((name) => p.entities.some((e) => e.name === name)));
  assert.ok(
    plan,
    `Expected entities for ${query}; got ${JSON.stringify(plans.map((p) => p.entities.map((e) => e.name)))}`,
  );
  assert.equal(parsed.error, undefined, query);
  const selection = {
    teamIds: plan.teamIds,
    ...(plan.venueId ? { venueId: plan.venueId } : {}),
    ...(plan.homeId ? { homeId: plan.homeId, awayId: plan.awayId } : {}),
  };
  const page = rpc(
    'search_games_v2',
    `${literal(JSON.stringify(parsed.filters))}::jsonb,${literal(JSON.stringify(selection))}::jsonb,${literal(query)},'all','best'`,
  );
  const expectedTeams = names
    .map(
      (name) =>
        `(g.home_team_id=(select id from teams where name=${literal(name)}) or g.away_team_id=(select id from teams where name=${literal(name)}))`,
    )
    .join(' and ');
  const expectedDates = [
    parsed.filters.from
      ? `game_local_date(g.scheduled_start,v.tz)>=${literal(parsed.filters.from)}::date`
      : 'true',
    parsed.filters.to
      ? `game_local_date(g.scheduled_start,v.tz)<=${literal(parsed.filters.to)}::date`
      : 'true',
  ].join(' and ');
  const direction = query.includes(' at ')
    ? `and g.away_team_id=(select id from teams where name=${literal(names[0])}) and g.home_team_id=(select id from teams where name=${literal(names[1])})`
    : '';
  const independentlyExpected = sql(
    `select coalesce(jsonb_agg(id),'[]') from (select g.id from games g left join venues v on v.id=g.venue_id where ${expectedTeams} and ${expectedDates} ${direction} order by g.scheduled_start desc,g.id desc limit 25) expected`,
  );
  assert.deepEqual(
    page.rows.map((g) => g.id),
    independentlyExpected,
    `${query}: exact first-page order/coverage`,
  );
  for (const g of page.rows) {
    assert.ok(
      plan.teamIds.every((id) => [g.home_team_id, g.away_team_id].includes(id)),
      query,
    );
    if (plan.homeId) assert.equal(g.home_team_id, plan.homeId);
    if (plan.awayId) assert.equal(g.away_team_id, plan.awayId);
    if (parsed.filters.from) assert.ok(g.local_date >= parsed.filters.from);
    if (parsed.filters.to) assert.ok(g.local_date <= parsed.filters.to);
  }
  const ms = Math.round(performance.now() - started);
  report.timingsMs.push(ms);
  report.cases.push({
    query,
    entities: plan.entities.map((e) => e.name),
    alternatives: plans.length,
    tier: plan.tier,
    rowsOnFirstPage: page.rows.length,
    elapsedIncludingDockerMs: ms,
  });
}
assert.ok(resolve('Giants').plans.length >= 2, 'Giants must remain ambiguous');
assert.equal(resolve('LAFC Galaxy birthday').plans.length, 0, 'unknown terms cannot disappear');
assert.equal(resolve('LAFC at LAFC').plans.length, 0, 'same team cannot fill both sides');
assert.ok(parseSearch('2025-02-29').error);
for (const query of ['AT&T Stadium', 'Staples Center']) {
  const ids = sql(
    `select jsonb_agg(venue_id) from venue_aliases where lower(alias)=lower(${literal(query)})`,
  );
  assert.ok(
    resolve(query).plans.some((p) => ids.includes(p.venueId)),
    `${query}: historical/compound venue name resolves to its exact alias`,
  );
}
// Full traversal of a loaded season proves page boundaries do not drop/duplicate games.
const filters = { sport: 'mls', from: '2025-01-01', to: '2025-12-31' };
const expected = sql(
  "select coalesce(jsonb_agg(g.id order by scheduled_start desc,g.id desc),'[]') from games g left join venues v on g.venue_id=v.id where sport_id='mls' and game_local_date(scheduled_start,v.tz) between '2025-01-01' and '2025-12-31'",
);
let cursor = null;
const received = [];
do {
  const page = rpc(
    'search_games_v2',
    `${literal(JSON.stringify(filters))}::jsonb,'{}','2025','all','best',${cursor ? literal(JSON.stringify(cursor)) + '::jsonb' : 'null'},25`,
  );
  received.push(...page.rows.map((g) => g.id));
  cursor = page.nextCursor;
} while (cursor);
assert.deepEqual(received, expected, 'paginated MLS 2025 matches independent SQL exactly');
report.pagination = {
  season: 2025,
  sport: 'mls',
  rows: received.length,
  exactOrderAndCoverage: true,
};
report.explain = {
  fuzzyAliases: sql(
    "explain (analyze, buffers, format json) select team_id from team_aliases where search_name operator(extensions.%) 'philies' and extensions.similarity(search_name,'philies')>=0.42",
    true,
  ),
  matchup: sql(
    'explain (analyze, buffers, format json) select public.search_games_v2(\'{"sport":"mls","from":"2025-01-01","to":"2025-12-31"}\')',
    true,
  ),
};
report.note =
  'Timings include Docker/psql process startup and two RPCs; not hosted p95. NBA has no games in this local dataset, so NBA date semantics are covered by transactional SQL fixtures.';
mkdirSync('docs/evidence/search', { recursive: true });
writeFileSync('docs/evidence/search/backtest.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  `Passed ${fixtures.length} entity/result cases, ambiguity/invalid-input checks and ${received.length}-row pagination backtest.`,
);
