/**
 * mlb-live: polls the MLB live feed for games that have an active check-in and writes
 * `game_live_state` (SPEC.md 6.4). Scheduled every minute by pg_cron, guarded by
 * games_needing_live_poll() so it only runs while someone is at a game.
 *
 * Since 2026-09-23 it is also the MLB half of the reaction engine (docs/prompts/social/03,
 * section 3.1): the same poll reads `/winProbability`, one entry per plate appearance with the
 * play and the probability after it, judges the plays it has not seen (packages/core,
 * `mlbPollStep`: the whitelist, the significance gate, the scheduled window) and fires what
 * clears the bar through `fire_reaction_prompt`, which applies the caps and targets the side.
 * `reaction_poll_state` remembers the last plate appearance judged, per game.
 */
import {
  MlbClient,
  MlbProvider,
  estimatedLock,
  mlbPollStep,
  type MlbLivePlay,
  type MlbPollState,
} from '../_shared/core/index.ts';
import { authorizeInternal, json, serviceDb } from '../_shared/db.ts';

interface Row {
  game_id: string;
  provider_game_id: string;
  sport_id: string;
  scheduled_start: string;
}

Deno.serve(async (req) => {
  if (!authorizeInternal(req)) return json({ error: 'unauthorized' }, 401);
  const db = serviceDb();
  const provider = new MlbProvider();
  const client = new MlbClient();
  const { data, error } = await db.rpc('games_needing_live_poll');
  if (error) return json({ error: error.message }, 500);
  // The poll function returns every sport with a live feed; nba-live takes the NBA rows.
  const rows = ((data ?? []) as Row[]).filter((r) => r.sport_id === 'mlb');
  const now = new Date().toISOString();
  const updated: string[] = [];
  const errors: string[] = [];
  const prompts: { game: string; kind: string; label: string; result: unknown }[] = [];
  for (const g of rows) {
    try {
      const feed = await client.feed(g.provider_game_id);
      const live = await provider.fetchLiveState(g.provider_game_id);
      const lock = estimatedLock('mlb', g.scheduled_start, live, now);
      await db.from('game_live_state').upsert(
        [
          {
            game_id: g.game_id,
            status: live.status,
            inning: live.inning,
            inning_state: live.inningState,
            home_score: live.homeScore,
            away_score: live.awayScore,
            locked: lock.locked,
            lock_reason: lock.reason,
            fetched_at: live.fetchedAt,
          },
        ],
        { onConflict: 'game_id' },
      );
      if (live.status === 'live' || live.status === 'final') {
        await db
          .from('games')
          .update({ status: live.status })
          .eq('id', g.game_id)
          .neq('status', 'final');
      }
      updated.push(g.provider_game_id);

      // The reaction half. A failure here never costs the live state above.
      try {
        if (live.status !== 'live' && live.status !== 'final') continue;
        const { data: stateRow } = await db
          .from('reaction_poll_state')
          .select('last_at_bat, scheduled_reported')
          .eq('game_id', g.game_id)
          .maybeSingle();
        const state: MlbPollState = {
          lastAtBat: (stateRow as { last_at_bat?: number } | null)?.last_at_bat ?? -1,
          scheduledReported: (stateRow as { scheduled_reported?: boolean } | null)?.scheduled_reported ?? false,
        };
        const entries = await client.getJson<MlbLivePlay[]>(`v1/game/${g.provider_game_id}/winProbability`);
        const out = mlbPollStep(state, {
          status: live.status,
          linescore: feed.liveData.linescore ?? null,
          entries,
          fetchedAt: now,
        });
        for (const e of out.events) {
          const { data: res } = await db.rpc('fire_reaction_prompt', {
            p_game_id: g.game_id,
            p_kind: 'event',
            p_label: e.label,
            p_audience: e.audience,
            p_significance: e.significance,
            p_event_key: e.key,
            p_window_seconds: 120,
            p_home_score: e.homeScore,
            p_away_score: e.awayScore,
            p_period_label: e.periodLabel,
            p_source: 'live',
            p_rule: e.rule,
            p_benefit_side: e.benefitSide,
            p_in_scheduled_window: scheduledWindowOpen(out.snapshot.period),
          });
          prompts.push({ game: g.provider_game_id, kind: 'event', label: e.label, result: res });
        }
        if (out.scheduled) {
          const { data: res } = await db.rpc('fire_reaction_prompt', {
            p_game_id: g.game_id,
            p_kind: 'checkin',
            p_label: 'late in the game',
            p_audience: 'all',
            p_significance: null,
            p_event_key: 'scheduled',
            p_window_seconds: 120,
            p_home_score: out.scheduled.homeScore,
            p_away_score: out.scheduled.awayScore,
            p_period_label: out.scheduled.periodLabel,
            p_source: 'live',
            p_rule: out.scheduled.reason,
            p_benefit_side: null,
            p_in_scheduled_window: true,
          });
          prompts.push({ game: g.provider_game_id, kind: 'checkin', label: out.scheduled.periodLabel, result: res });
        }
        await db.from('reaction_poll_state').upsert(
          [{ game_id: g.game_id, last_at_bat: out.next.lastAtBat, scheduled_reported: out.next.scheduledReported, updated_at: now }],
          { onConflict: 'game_id' },
        );
      } catch (err) {
        errors.push(`${g.provider_game_id} reactions: ${String(err)}`);
      }
    } catch (err) {
      errors.push(`${g.provider_game_id}: ${String(err)}`);
    }
  }
  return json({ polled: rows.length, updated, prompts, errors });
});

/** The MLB late window: the 7th and 8th (packages/core, SCHEDULED_WINDOWS.mlb). */
function scheduledWindowOpen(inning: number | null): boolean {
  return inning != null && inning >= 7 && inning < 9;
}
