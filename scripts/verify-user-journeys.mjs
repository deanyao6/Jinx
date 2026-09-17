#!/usr/bin/env node
/**
 * Plays three milestone "Done when" lines from SPEC.md Section 12 as real signed-in users, through
 * the same API the app uses, so row level security is in the loop instead of bypassed.
 *
 *   M2  a new user signs up, picks teams, logs 10 past games including a doubleheader, sees them
 *       in History, and cannot read another user's private data
 *   M3  the passport is right for those games: the overall record matches the scores
 *   M6  a placeholder "Dad" tagged at 5 games is linked to a new account, that account imports 3
 *       of them, and the records are correct for both users
 *   M7  the feed paginates
 *   M8  the "HR in 5 ballparks with a walk-off" goal completes on real ingested games and fires
 *       a notification, through the deployed evaluate-goals function (needs CRON_SECRET)
 *
 * Users are throwaways created here (jinx-journey-*@example.com) and deleted at the end, whatever
 * happens. Sign-up itself is Sign in with Apple in the app and cannot be scripted; the accounts
 * are created with the admin API and then everything else is done as that user.
 *
 *   eval "$(npx supabase status -o env | sed 's/^/export /')"
 *   SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
 *     node scripts/verify-user-journeys.mjs
 */
import { randomBytes } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const env = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`missing ${name}`);
    process.exit(2);
  }
  return v;
};
const URL = env('SUPABASE_URL');
const ANON = env('SUPABASE_ANON_KEY');
const admin = createClient(URL, env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

const created = [];
async function newUser(label) {
  const email = `jinx-journey-${label}-${randomBytes(5).toString('hex')}@example.com`;
  const password = randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`create ${label}: ${error.message}`);
  created.push(data.user.id);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  must(await client.auth.signInWithPassword({ email, password }), `sign in ${label}`);
  return { id: data.user.id, client };
}

async function main() {
  // ------------------------------------------------------------------ M2: onboarding
  const fan = await newUser('fan');
  const handle = `journey_${randomBytes(4).toString('hex')}`;
  must(
    await fan.client
      .from('profiles')
      .update({ handle, display_name: 'Journey Fan', home_city: 'Philadelphia' })
      .eq('id', fan.id),
    'profile',
  );
  const phillies = must(
    await fan.client
      .from('teams')
      .select('id, name')
      .eq('sport_id', 'mlb')
      .eq('name', 'Philadelphia Phillies')
      .single(),
    'find the Phillies',
  );
  must(
    await fan.client.from('user_teams').insert({ user_id: fan.id, team_id: phillies.id }),
    'pick a team',
  );
  check('M2 a new user sets a handle, a home city and a favorite team', true, `@${handle}`);

  // A real doubleheader: two Phillies home finals on one date.
  const season = must(
    await fan.client
      .from('games')
      .select('id, scheduled_start, doubleheader_number, home_score, away_score, home_team_id')
      .eq('sport_id', 'mlb')
      .eq('status', 'final')
      .eq('game_type', 'regular')
      .eq('home_team_id', phillies.id)
      .gte('season', 2018)
      .order('scheduled_start', { ascending: true })
      .limit(1000),
    'Phillies home games',
  );
  const twin = season.filter((g) => (g.doubleheader_number ?? 0) >= 1);
  const byDay = new Map();
  for (const g of twin) {
    const day = g.scheduled_start.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), g]);
  }
  const pair = [...byDay.values()].find((list) => list.length === 2);
  if (!pair) throw new Error('no Phillies home doubleheader in the data');
  const others = season.filter((g) => !pair.includes(g)).slice(0, 8);
  const ten = [...pair, ...others];

  for (const g of ten) {
    must(
      await fan.client.from('attendances').insert({
        user_id: fan.id,
        game_id: g.id,
        source: 'manual',
        status: 'attended',
        rooting_team_id: phillies.id,
        rooting_basis: 'favorite',
      }),
      'log a game',
    );
  }
  const history = must(
    await fan.client
      .from('attendances')
      .select('id, game_id, verified')
      .eq('user_id', fan.id)
      .eq('status', 'attended'),
    'history',
  );
  check('M2 ten past games are logged and come back in History', history.length === 10);
  check(
    'M2 both halves of a doubleheader are logged as separate games',
    pair.every((g) => history.some((h) => h.game_id === g.id)),
    pair[0].scheduled_start.slice(0, 10),
  );
  check(
    'M2 manual entries are unverified (SPEC 6.3)',
    history.every((h) => h.verified === false),
  );
  const again = await fan.client.from('attendances').insert({
    user_id: fan.id,
    game_id: ten[0].id,
    source: 'manual',
    status: 'attended',
  });
  check('M2 the same game cannot be logged twice', !!again.error);

  // ------------------------------------------------------------------ M3: the passport
  const stats = must(await fan.client.rpc('refresh_my_stats'), 'refresh_my_stats');
  const expected = ten.reduce(
    (acc, g) => {
      if (g.home_score > g.away_score) acc.wins += 1;
      else if (g.home_score < g.away_score) acc.losses += 1;
      else acc.ties += 1;
      return acc;
    },
    { wins: 0, losses: 0, ties: 0 },
  );
  const overall = stats.overall ?? {};
  check(
    'M3 the overall record equals the ten final scores, counted by hand',
    overall.wins === expected.wins && overall.losses === expected.losses,
    `passport ${overall.wins}-${overall.losses}, scores ${expected.wins}-${expected.losses}`,
  );
  check(
    'M3 one stadium stamp for ten games at one ballpark',
    (stats.stamps ?? []).length === 1 && stats.stamps[0].visits === 10,
    `${(stats.stamps ?? []).length} stamp(s)`,
  );

  // ------------------------------------------------------------------ M2: privacy
  must(
    await fan.client.from('profiles').update({ is_private: true }).eq('id', fan.id),
    'go private',
  );
  const stranger = await newUser('stranger');
  must(
    await stranger.client
      .from('profiles')
      .update({ handle: `stranger_${randomBytes(4).toString('hex')}` })
      .eq('id', stranger.id),
    'stranger profile',
  );
  const peek = await stranger.client.from('attendances').select('id').eq('user_id', fan.id);
  check(
    "M2 another user cannot read a private user's games",
    !peek.error && (peek.data ?? []).length === 0,
    `${(peek.data ?? []).length} rows visible`,
  );
  const peekStats = await stranger.client
    .from('user_stats_cache')
    .select('user_id')
    .eq('user_id', fan.id);
  check('M2 nor their passport', (peekStats.data ?? []).length === 0);
  must(
    await fan.client.from('profiles').update({ is_private: false }).eq('id', fan.id),
    'go public',
  );

  // ------------------------------------------------------------------ M7, M8
  await feedPaginates(fan);
  await goalCompletes(fan);

  // ------------------------------------------------------------------ M6: Dad
  const dadPerson = must(
    await fan.client
      .from('people')
      .insert({ owner_user_id: fan.id, display_name: 'Dad' })
      .select('id')
      .single(),
    'placeholder Dad',
  );
  const five = history.slice(0, 5);
  must(
    await fan.client
      .from('attendance_companions')
      .insert(five.map((h) => ({ attendance_id: h.id, person_id: dadPerson.id }))),
    'tag Dad at five games',
  );
  const hidden = await stranger.client.from('people').select('id').eq('id', dadPerson.id);
  check('M6 a placeholder person is visible only to its owner', (hidden.data ?? []).length === 0);

  const token = must(
    await fan.client.rpc('create_person_invite', { p_person_id: dadPerson.id }),
    'create invite',
  );
  const dad = await newUser('dad');
  must(
    await dad.client
      .from('profiles')
      .update({ handle: `dad_${randomBytes(4).toString('hex')}`, display_name: 'Dad' })
      .eq('id', dad.id),
    'dad profile',
  );
  const accepted = must(await dad.client.rpc('accept_person_invite', { p_token: token }), 'accept');
  check(
    'M6 the invite links Dad to his new account',
    accepted.ok === true,
    JSON.stringify(accepted),
  );
  check('M6 and reports the five games he was tagged at', accepted.tagged_games === 5);

  const offered = must(await dad.client.rpc('tagged_games_for_me', { p_owner: fan.id }), 'tagged');
  check('M6 Dad is offered those five games, none forced on him', offered.length === 5);
  const chosen = offered.slice(0, 3).map((g) => g.game_id);
  const imported = must(
    await dad.client.rpc('import_tagged_games', { p_owner: fan.id, p_game_ids: chosen }),
    'import',
  );
  check('M6 Dad imports three of them', imported === 3);
  const dadHistory = must(
    await dad.client.from('attendances').select('game_id').eq('user_id', dad.id),
    'dad history',
  );
  check('M6 exactly those three are in his History', dadHistory.length === 3);

  const fanRecords = must(await fan.client.rpc('companion_records'), 'fan companion records');
  const withDad = fanRecords.find((r) => r.person_id === dadPerson.id);
  const fiveGames = ten.filter((g) => five.some((h) => h.game_id === g.id));
  const wins5 = fiveGames.filter((g) => g.home_score > g.away_score).length;
  check(
    "M6 the fan's record with Dad covers all five games and matches the scores",
    !!withDad && withDad.games === 5 && withDad.wins === wins5,
    withDad ? `${withDad.wins}-${withDad.losses} in ${withDad.games}` : 'no row',
  );
  const dadStats = must(await dad.client.rpc('refresh_my_stats'), 'dad stats');
  check(
    "M6 Dad's own passport counts only the three he imported",
    dadStats.totals?.games === 3 || dadStats.totals?.attended === 3,
    JSON.stringify(dadStats.totals),
  );
}

/** M7: the feed pages backwards by timestamp with no row repeated or skipped. */
async function feedPaginates(fan) {
  const first = must(await fan.client.rpc('feed', { p_limit: 4 }), 'feed page 1');
  const before = first.at(-1)?.created_at;
  const second = must(
    await fan.client.rpc('feed', { p_before: before, p_limit: 4 }),
    'feed page 2',
  );
  const all = must(await fan.client.rpc('feed', { p_limit: 8 }), 'feed first eight');
  const ids = [...first, ...second].map((r) => r.id);
  check('M7 the feed has a second page', first.length === 4 && second.length === 4);
  check('M7 no event appears on both pages', new Set(ids).size === ids.length);
  check(
    'M7 two pages of four are exactly the first eight, newest first',
    JSON.stringify(ids) === JSON.stringify(all.map((r) => r.id)),
  );
}

/** M8: the spec's own example goal, on real games, completed by the real function. */
async function goalCompletes(fan) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    check('M8 evaluate-goals can be called', false, 'CRON_SECRET not given');
    return;
  }
  // Real ingested MLB games: home runs at five different ballparks, one of them a walk-off.
  const homers = must(
    await admin
      .from('game_events')
      .select('game_id, type, games!inner(venue_id, sport_id, scheduled_start)')
      .eq('games.sport_id', 'mlb')
      .in('type', ['home_run', 'walk_off'])
      .limit(1000),
    'moments',
  );
  const byGame = new Map();
  for (const e of homers) {
    const g = byGame.get(e.game_id) ?? { id: e.game_id, venue: e.games.venue_id, types: new Set() };
    g.types.add(e.type);
    byGame.set(e.game_id, g);
  }
  const games = [...byGame.values()].filter((g) => g.types.has('home_run'));
  const walkOff = games.find((g) => g.types.has('walk_off'));
  if (!walkOff) throw new Error('no ingested game has both a home run and a walk-off');
  const venues = new Set([walkOff.venue]);
  const four = [];
  for (const g of games) {
    if (four.length === 4) break;
    if (g.types.has('walk_off') || venues.has(g.venue)) continue;
    venues.add(g.venue);
    four.push(g);
  }
  if (four.length < 4) throw new Error('fewer than five ballparks with a home run are ingested');

  const goal = must(
    await fan.client
      .from('goals')
      .insert({
        user_id: fan.id,
        year: new Date().getUTCFullYear(),
        title: 'A home run in 5 ballparks, and a walk-off',
        source: 'custom',
        definition: {
          type: 'all_of',
          items: [
            { type: 'distinct_venues', target: 5, filter: { event: 'home_run' } },
            { type: 'count', target: 1, filter: { event: 'walk_off' } },
          ],
        },
      })
      .select('id')
      .single(),
    'create goal',
  );
  const evaluate = async () => {
    const res = await fetch(`${URL}/functions/v1/evaluate-goals`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'x-cron-secret': secret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_ids: [fan.id] }),
    });
    if (res.status !== 200) throw new Error(`evaluate-goals HTTP ${res.status}`);
    return must(
      await fan.client.from('goals').select('progress, completed_at').eq('id', goal.id).single(),
      'read goal',
    );
  };
  const log = async (g) =>
    must(
      await fan.client
        .from('attendances')
        .insert({ user_id: fan.id, game_id: g.id, source: 'manual', status: 'attended' }),
      'log a goal game',
    );

  for (const g of four) await log(g);
  const partial = await evaluate();
  check(
    'M8 four ballparks and no walk-off: in progress, not complete',
    partial.completed_at === null && partial.progress?.completed === false,
    JSON.stringify(partial.progress),
  );
  await log(walkOff);
  const done = await evaluate();
  check(
    'M8 the fifth ballpark, with a walk-off, completes the goal',
    done.completed_at !== null && done.progress?.completed === true,
    JSON.stringify(done.progress),
  );
  const notes = must(
    await fan.client
      .from('notifications')
      .select('kind, title, body')
      .eq('user_id', fan.id)
      .eq('kind', 'goal_completed'),
    'notifications',
  );
  check(
    'M8 and fires exactly one notification',
    notes.length === 1 && notes[0].body === 'A home run in 5 ballparks, and a walk-off',
    `${notes.length} notification(s)`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    results.push(false);
  })
  .finally(async () => {
    for (const id of created) await admin.auth.admin.deleteUser(id);
    console.log(`\nremoved ${created.length} throwaway user(s)`);
    const failed = results.filter((ok) => !ok).length;
    console.log(`${results.length - failed}/${results.length} checks passed`);
    process.exit(failed === 0 ? 0 : 1);
  });
