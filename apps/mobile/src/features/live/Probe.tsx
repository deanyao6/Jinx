import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';

import { MLS_SUMMARY_URL, NBA_SCOREBOARD_URL, mlsLiveFeed, nbaLiveFeed, nflLiveFeed, nflScoreboardUrl } from './feeds';

type Result = { label: string; outcome: string; ms: number };

/**
 * Development only: proves from a device build that the public live feeds answer a fetch from
 * React Native (the VERIFY in docs/prompts/next-wave.md part C; ESPN's NFL scoreboard added for
 * 00_repo_reality.md R1). Reached with `jinx:///you/eggs?probe=live`. Each row is the HTTP
 * status and what the parser made of it.
 */
export function LiveFeedProbe() {
  const [results, setResults] = useState<Result[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timed = async (label: string, run: () => Promise<string>): Promise<Result> => {
      const t0 = Date.now();
      try {
        return { label, outcome: await run(), ms: Date.now() - t0 };
      } catch (e) {
        return { label, outcome: `failed: ${e instanceof Error ? e.message : String(e)}`, ms: Date.now() - t0 };
      }
    };
    void (async () => {
      const out: Result[] = [];
      out.push(
        await timed('cdn.nba.com scoreboard', async () => {
          const res = await fetch(NBA_SCOREBOARD_URL, {
            headers: { Accept: 'application/json', Referer: 'https://www.nba.com/', Origin: 'https://www.nba.com' },
          });
          const body = (await res.json()) as { scoreboard?: { gameDate?: string; games?: unknown[] } };
          return `HTTP ${res.status}, gameDate ${body.scoreboard?.gameDate ?? '?'}, ${body.scoreboard?.games?.length ?? 0} games`;
        }),
      );
      out.push(
        await timed('cdn.nba.com boxscore 0022500001', async () => {
          const res = await fetch(
            'https://cdn.nba.com/static/json/liveData/boxscore/boxscore_0022500001.json',
            { headers: { Accept: 'application/json', Referer: 'https://www.nba.com/', Origin: 'https://www.nba.com' } },
          );
          const body = (await res.json()) as { game?: { gameStatusText?: string; homeTeam?: { score?: number }; awayTeam?: { score?: number } } };
          return `HTTP ${res.status}, ${body.game?.gameStatusText ?? '?'} ${body.game?.awayTeam?.score ?? '?'}-${body.game?.homeTeam?.score ?? '?'}`;
        }),
      );
      out.push(
        await timed('nba feed, todays board', async () => {
          const live = await nbaLiveFeed.fetchLive({ provider_game_id: '0022500001', scheduled_start: '2025-10-21T23:30:00Z' });
          return live ? `${live.status} Q${live.inning} ${live.clock ?? ''} ${live.away_score}-${live.home_score}` : 'not on today’s board (null: countdown keeps its estimate)';
        }),
      );
      out.push(
        await timed('espn summary 761829', async () => {
          const res = await fetch(`${MLS_SUMMARY_URL}?event=761829`, { headers: { Accept: 'application/json' } });
          const body = (await res.json()) as { header?: { competitions?: { status?: { type?: { name?: string } } }[] } };
          return `HTTP ${res.status}, ${body.header?.competitions?.[0]?.status?.type?.name ?? '?'}`;
        }),
      );
      out.push(
        await timed('mls feed 761829', async () => {
          const live = await mlsLiveFeed.fetchLive({ provider_game_id: '761829', scheduled_start: '2026-09-20T23:00:00Z' });
          return live ? `${live.status} period ${live.inning} ${live.inning_state} ${live.away_score}-${live.home_score}` : 'null';
        }),
      );
      out.push(
        await timed('espn nfl scoreboard 2026-09-21', async () => {
          const res = await fetch(nflScoreboardUrl('2026-09-22T00:15:00Z'), { headers: { Accept: 'application/json' } });
          const body = (await res.json()) as { events?: { name?: string; competitions?: { status?: { type?: { name?: string } } }[] }[] };
          const first = body.events?.[0];
          return `HTTP ${res.status}, ${body.events?.length ?? 0} events, ${first?.name ?? '?'}: ${first?.competitions?.[0]?.status?.type?.name ?? '?'}`;
        }),
      );
      out.push(
        await timed('nfl feed 2026_02_NYG_LA', async () => {
          const live = await nflLiveFeed.fetchLive({ provider_game_id: '2026_02_NYG_LA', scheduled_start: '2026-09-22T00:15:00Z' });
          return live ? `${live.status} Q${live.inning} ${live.inning_state} ${live.away_score}-${live.home_score}` : 'null';
        }),
      );
      out.push(
        await timed('nfl feed, today’s board', async () => {
          const res = await fetch(nflScoreboardUrl(new Date().toISOString()), { headers: { Accept: 'application/json' } });
          const body = (await res.json()) as { events?: { name?: string; competitions?: { status?: { type?: { name?: string }; period?: number; displayClock?: string }; situation?: { lastPlay?: { type?: { text?: string }; probability?: unknown } } }[] }[] };
          const live = body.events?.find((e) => e.competitions?.[0]?.status?.type?.name === 'STATUS_IN_PROGRESS');
          const c = live?.competitions?.[0];
          return live
            ? `${live.name}: Q${c?.status?.period} ${c?.status?.displayClock}, lastPlay ${c?.situation?.lastPlay?.type?.text ?? 'none'}, probability ${c?.situation?.lastPlay?.probability ? 'yes' : 'no'}`
            : `HTTP ${res.status}, ${body.events?.length ?? 0} events, none under way`;
        }),
      );
      if (!cancelled) setResults(out);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Card>
      <Text variant="bodyStrong">Live feed probe</Text>
      <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
        The public feeds, fetched from this build.
      </Text>
      <View style={{ marginTop: 8, gap: 6 }}>
        {results === null ? (
          <Text variant="sub" color="muted">
            Fetching...
          </Text>
        ) : (
          results.map((r) => (
            <View key={r.label}>
              <Text variant="caption" color="muted">
                {r.label} ({r.ms} ms)
              </Text>
              <Text variant="sub" testID={`probe-${r.label}`}>
                {r.outcome}
              </Text>
            </View>
          ))
        )}
      </View>
    </Card>
  );
}
