import { planLabel, type SearchEntity, type SearchFilters, type SearchPlan } from '@jinx/core';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FormScreen } from '@/components/FormScreen';
import { GameRow } from '@/components/GameRow';
import { Loading } from '@/components/Loading';
import { Notice } from '@/components/Notice';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDebounced } from '../ui/useDebounced';
import {
  useRankedGames,
  useSearchInterpretation,
  type SearchScope,
  type SearchSort,
} from './queries';

export function SearchScreen({
  initialScope = 'all',
  initialQuery = '',
}: {
  initialScope?: SearchScope;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>(initialScope);
  const [sort, setSort] = useState<SearchSort>('best');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showDates, setShowDates] = useState(false);
  const [choice, setChoice] = useState<{ key: string; plan: SearchPlan }>();
  const debounced = useDebounced(query);
  const interpretation = useSearchInterpretation(debounced, filters);
  const key = JSON.stringify([debounced, filters]);
  const chosen = choice?.key === key ? choice.plan : undefined;
  const plan = chosen ?? (interpretation.plans.length === 1 ? interpretation.plans[0] : undefined);
  const ambiguous = !chosen && interpretation.plans.length > 1;
  const unresolved =
    !interpretation.resolving &&
    interpretation.parsed.words.length > 0 &&
    interpretation.plans.length === 0;
  const personalText = scope === 'mine' && unresolved;
  const mismatch =
    !!plan &&
    ((filters.teamId && plan.teamIds.length > 0 && !plan.teamIds.includes(filters.teamId)) ||
      (filters.venueId && plan.venueId && filters.venueId !== plan.venueId));
  const error =
    interpretation.parsed.error ??
    (mismatch
      ? 'The query conflicts with a selected team or venue. Clear the filter or edit the query.'
      : undefined);
  const active = !!query.trim() || Object.values(filters).some(Boolean) || scope === 'mine';
  const waiting = query !== debounced || interpretation.resolving;
  const ready =
    active &&
    !waiting &&
    !error &&
    !interpretation.isError &&
    !ambiguous &&
    (!unresolved || personalText);
  const results = useRankedGames({
    query: personalText ? interpretation.parsed.words.join(' ') : debounced,
    filters: interpretation.parsed.filters,
    plan,
    scope,
    sort,
    personalText,
    enabled: ready,
  });
  const rows = ready ? (results.data?.pages.flatMap((p) => p.rows) ?? []) : [];
  const removeEntity = (entity: SearchEntity) => {
    setFilters(interpretation.parsed.filters);
    setQuery(
      interpretation.parsed.words
        .filter((w, i) => (i < entity.start || i >= entity.end) && w !== 'at' && w !== 'vs')
        .join(' '),
    );
  };
  const clearFilter = (field: keyof SearchFilters) => {
    setFilters((old) => {
      const next = { ...old };
      delete next[field];
      return next;
    });
  };
  const removeParsedDate = () => {
    const next = { ...interpretation.parsed.filters };
    delete next.from;
    delete next.to;
    delete next.season;
    setFilters(next);
    setQuery(interpretation.parsed.words.join(' '));
  };
  return (
    <FormScreen>
      <Segmented
        options={[
          { key: 'mine', label: 'My games' },
          { key: 'all', label: 'All games' },
        ]}
        value={scope}
        onChange={setScope}
      />
      <TextField
        label="Search games"
        accessibilityLabel="Search games"
        value={query}
        onChangeText={setQuery}
        placeholder={
          scope === 'mine'
            ? 'Team, venue, date, score or companion'
            : 'Team, opponent, venue or date'
        }
        autoCorrect={false}
        autoCapitalize="none"
        maxLength={160}
        clearButtonMode="while-editing"
      />
      <Text variant="caption" color="muted">
        A year means calendar year. Add “season” to search by season.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12 }}>
        {['mlb', 'nfl', 'nba', 'mls'].map((sport) => (
          <Chip
            key={sport}
            label={sport.toUpperCase()}
            selected={filters.sport === sport}
            onPress={() =>
              setFilters((old) => ({ ...old, sport: old.sport === sport ? undefined : sport }))
            }
          />
        ))}
        <Chip label="Dates" selected={showDates} onPress={() => setShowDates(!showDates)} />
        <Chip
          label="Past"
          selected={filters.time === 'past'}
          onPress={() =>
            setFilters((old) => ({ ...old, time: old.time === 'past' ? undefined : 'past' }))
          }
        />
        <Chip
          label="Upcoming"
          selected={filters.time === 'upcoming'}
          onPress={() =>
            setFilters((old) => ({
              ...old,
              time: old.time === 'upcoming' ? undefined : 'upcoming',
            }))
          }
        />
      </View>
      {showDates ? (
        <View>
          <TextField
            label="From"
            value={filters.from ?? ''}
            placeholder="YYYY-MM-DD"
            onChangeText={(from) => setFilters((old) => ({ ...old, from: from || undefined }))}
          />
          <TextField
            label="To"
            value={filters.to ?? ''}
            placeholder="YYYY-MM-DD"
            onChangeText={(to) => setFilters((old) => ({ ...old, to: to || undefined }))}
          />
          <TextField
            label="Season start year"
            value={filters.season == null ? '' : String(filters.season)}
            placeholder="2025"
            keyboardType="number-pad"
            onChangeText={(season) =>
              setFilters((old) => ({ ...old, season: season ? Number(season) : undefined }))
            }
          />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(interpretation.parsed.filters.from && !filters.from) ||
        (interpretation.parsed.filters.season && !filters.season) ? (
          <Chip
            label={`${interpretation.parsed.filters.season ? `Season ${interpretation.parsed.filters.season}` : `${interpretation.parsed.filters.from} to ${interpretation.parsed.filters.to}`} ×`}
            selected
            onPress={removeParsedDate}
          />
        ) : null}
        {Object.entries(filters)
          .filter(([field, value]) => value != null && !['sport', 'time'].includes(field))
          .map(([field, value]) => (
            <Chip
              key={field}
              label={`${field === 'season' ? 'Season' : field}: ${value} ×`}
              selected
              onPress={() => clearFilter(field as keyof SearchFilters)}
            />
          ))}
        {plan?.entities.map((e) => (
          <Chip
            key={`${e.kind}:${e.id}`}
            label={`${e.name} ×`}
            selected
            onPress={() => removeEntity(e)}
          />
        ))}
      </View>
      {plan?.entities
        .filter((e) => e.tier === 2 || e.alias !== e.name)
        .map((e) => (
          <Text key={e.id} variant="caption" color="muted">
            {e.tier === 2
              ? `Matched ${e.name} from “${e.phrase}”.`
              : `Matched ${e.name} through “${e.alias}”.`}
          </Text>
        ))}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {interpretation.isError ? (
        <View>
          <Notice tone="error">Could not load search suggestions. Check your connection.</Notice>
          <Button title="Retry suggestions" onPress={() => void interpretation.refetch()} />
        </View>
      ) : null}
      {!error && !waiting && ambiguous ? (
        <View>
          <Text variant="bodyStrong">Which did you mean?</Text>
          {interpretation.plans.map((p) => (
            <Button
              key={planLabel(p)}
              title={planLabel(p)}
              variant="secondary"
              onPress={() => setChoice({ key, plan: p })}
            />
          ))}
        </View>
      ) : null}
      {!error &&
      !waiting &&
      !interpretation.isError &&
      !ambiguous &&
      query.trim().length >= 2 &&
      !chosen ? (
        <View>
          {(['team', 'venue'] as const).map((kind) => {
            const candidates = interpretation.candidates.filter(
              (c) => c.kind === kind && c.phrase === interpretation.parsed.words.join(' '),
            );
            if (!candidates.length) return null;
            return (
              <View key={kind}>
                <Text variant="label">{kind === 'team' ? 'Teams' : 'Venues'}</Text>
                {candidates.slice(0, 5).map((c) => (
                  <Chip
                    key={c.id}
                    label={c.label}
                    onPress={() => {
                      const nextPlan: SearchPlan = {
                        entities: [{ ...c, start: 0, end: interpretation.parsed.words.length }],
                        teamIds: c.kind === 'team' ? [c.id] : [],
                        ...(c.kind === 'venue' ? { venueId: c.id } : {}),
                        tier: 0,
                        quality: 1000,
                      };
                      setChoice({ key, plan: nextPlan });
                    }}
                  />
                ))}
              </View>
            );
          })}
        </View>
      ) : null}
      <Segmented
        options={[
          { key: 'best', label: 'Best match' },
          { key: 'newest', label: 'Newest' },
          { key: 'oldest', label: 'Oldest' },
        ]}
        value={sort}
        onChange={setSort}
      />
      {waiting || (ready && results.isPending) ? <Loading label="Searching" /> : null}
      {!active ? (
        <Text color="muted">Try “Phillies 2025”, “LAFC vs Galaxy” or a venue name.</Text>
      ) : null}
      {unresolved && !personalText && !error && !interpretation.isError ? (
        <Notice>
          Some words could not be matched. Try a team, venue, year or month and year. No filters
          were removed.
        </Notice>
      ) : null}
      {personalText && !waiting ? (
        <Text variant="caption" color="muted">
          Searching text in your logged games, including companions and scores.
        </Text>
      ) : null}
      {ready && results.isError ? (
        <View>
          <Notice tone="error">Search failed. Check your connection and try again.</Notice>
          <Button title="Retry search" onPress={() => void results.refetch()} />
        </View>
      ) : null}
      {ready && !results.isPending && !results.isError && rows.length === 0 ? (
        <View>
          <Text>No games found. Edit your query or remove a filter.</Text>
          {scope === 'mine' ? (
            <Button title="Search all games" variant="secondary" onPress={() => setScope('all')} />
          ) : null}
        </View>
      ) : null}
      {rows.length ? (
        <Text variant="caption" color="muted">
          {rows.length} results loaded
          {results.isFetching && !results.isFetchingNextPage ? ' · updating' : ''}
        </Text>
      ) : null}
      {rows.map((g) => (
        <View key={g.id}>
          <GameRow
            game={{
              ...g,
              homeName: g.home_team_name,
              awayName: g.away_team_name,
              venueName: g.venue_name,
            }}
            badge={g.logged ? 'Logged' : null}
            onPress={() => router.push(g.logged ? `/games/${g.id}` : `/games/log/${g.id}`)}
          />
          {g.home_shootout_score != null && g.away_shootout_score != null ? (
            <Text variant="caption" color="muted">
              {g.decision_method === 'aggregate_shootout' ? 'Series penalties' : 'Penalties'}:{' '}
              {g.away_abbr} {g.away_shootout_score}–{g.home_shootout_score} {g.home_abbr}
            </Text>
          ) : null}
        </View>
      ))}
      {ready && results.hasNextPage ? (
        <Button
          title="Load more"
          loading={results.isFetchingNextPage}
          disabled={results.isFetchingNextPage}
          onPress={() => void results.fetchNextPage()}
        />
      ) : null}
    </FormScreen>
  );
}
