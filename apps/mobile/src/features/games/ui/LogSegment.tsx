import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GameRow } from '@/components/GameRow';
import { Loading } from '@/components/Loading';
import { TextField } from '@/components/TextField';
import { useMyAttendances } from '@/features/attendances/queries';
import { hasSearchInput, useSearchGames, type GameSearchParams } from '@/features/games/queries';
import { useSearchTeams } from '@/features/teams/queries';
import { isIsoDate, seasonOptions, sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { useDebounced } from './useDebounced';

const SPORTS = ['mlb', 'nfl', 'nba'] as const;

type Props = {
  /** Prefill from an import that could not be matched (teams and the ticket date). */
  initialQuery?: string;
  initialDate?: string;
};

export function LogSegment({ initialQuery = '', initialDate = '' }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [sport, setSport] = useState<string | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [showSeasons, setShowSeasons] = useState(false);
  const [showDates, setShowDates] = useState(!!initialDate);
  const [from, setFrom] = useState(initialDate);
  const [to, setTo] = useState(initialDate);
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null);

  const debouncedQuery = useDebounced(query);
  const teamHits = useSearchTeams(debouncedQuery, sport);
  const attendances = useMyAttendances();
  const loggedIds = useMemo(
    () => new Set((attendances.data ?? []).map((a) => a.game_id)),
    [attendances.data],
  );

  const params: GameSearchParams = {
    query: debouncedQuery,
    sport,
    season,
    from: isIsoDate(from) ? from : null,
    to: isIsoDate(to) ? to : null,
    teamId: team?.id ?? null,
    venueId: null,
  };
  const active = hasSearchInput(params);
  const results = useSearchGames(params, active);

  const pickTeam = (hit: { id: string; name: string }) => {
    setTeam(hit);
    setQuery('');
  };

  return (
    <>
      <TextField
        placeholder="Team, opponent, venue, or year"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        accessibilityLabel="Search games"
      />
      {teamHits.data?.length && query.trim().length >= 2 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.xs }}>
          {teamHits.data.map((t) => (
            <Chip key={t.id} label={`${t.name}`} onPress={() => pickTeam(t)} />
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        {team ? <Chip label={team.name} selected onPress={() => setTeam(null)} /> : null}
        {SPORTS.map((s) => (
          <Chip
            key={s}
            label={sportLabel(s)}
            selected={sport === s}
            onPress={() => setSport(sport === s ? null : s)}
          />
        ))}
        <Chip
          label={season ? String(season) : 'Season'}
          selected={season != null}
          onPress={() => setShowSeasons((v) => !v)}
        />
        <Chip
          label={params.from || params.to ? 'Dates set' : 'Dates'}
          selected={!!(params.from || params.to)}
          onPress={() => setShowDates((v) => !v)}
        />
      </View>
      {showSeasons ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: theme.spacing.sm }}
        >
          <Chip label="Any" selected={season == null} onPress={() => setSeason(null)} />
          {seasonOptions().map((y) => (
            <Chip key={y} label={String(y)} selected={season === y} onPress={() => setSeason(y)} />
          ))}
        </ScrollView>
      ) : null}
      {showDates ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <TextField
            label="From"
            placeholder="YYYY-MM-DD"
            value={from}
            onChangeText={setFrom}
            keyboardType="numbers-and-punctuation"
            containerStyle={{ flex: 1 }}
            error={from && !isIsoDate(from) ? 'Use YYYY-MM-DD' : null}
          />
          <TextField
            label="To"
            placeholder="YYYY-MM-DD"
            value={to}
            onChangeText={setTo}
            keyboardType="numbers-and-punctuation"
            containerStyle={{ flex: 1 }}
            error={to && !isIsoDate(to) ? 'Use YYYY-MM-DD' : null}
          />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
          marginTop: theme.spacing.xs,
        }}
      >
        <Button
          title="Log a whole season at once"
          variant="secondary"
          small
          onPress={() => router.push('/games/bulk')}
        />
        <Button
          title="Upload tickets"
          variant="secondary"
          small
          onPress={() => router.push('/games/import')}
        />
      </View>

      {!active ? (
        <EmptyState
          title="Find a game"
          body="Try “Phillies 2019”, “Eagles at Cowboys”, or a venue name. Filters narrow it down."
        />
      ) : results.isPending ? (
        <Loading label="Searching" />
      ) : results.isError ? (
        <ErrorNotice
          error={results.error}
          message="Search failed. Check your connection and try again."
          onRetry={results.refetch}
        />
      ) : results.data && results.data.length === 0 ? (
        <EmptyState title="No games found" body="Try fewer words or a different season." />
      ) : (
        <Card
          label={`${results.data?.length ?? 0} game${results.data?.length === 1 ? '' : 's'}${results.isFetching ? ' · updating' : ''}`}
        >
          {(results.data ?? []).map((g, i) => (
            <GameRow
              key={g.id}
              first={i === 0}
              game={{
                id: g.id,
                scheduled_start: g.scheduled_start,
                status: g.status,
                awayName: g.away_team_name,
                homeName: g.home_team_name,
                venueName: g.venue_name,
                home_score: g.home_score,
                away_score: g.away_score,
                is_tie: g.is_tie,
                doubleheader_number: g.doubleheader_number,
              }}
              badge={loggedIds.has(g.id) ? 'Logged' : null}
              onPress={() =>
                router.push(loggedIds.has(g.id) ? `/games/${g.id}` : `/games/log/${g.id}`)
              }
            />
          ))}
        </Card>
      )}
    </>
  );
}
