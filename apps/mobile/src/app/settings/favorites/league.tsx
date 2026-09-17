import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { SectionHeader } from '@/components/SectionHeader';
import { PickRow } from '@/features/account/ui/PickRow';
import { SettingsFrame } from '@/features/account/ui/SettingsFrame';
import { sportLabel } from '@/lib/format';

/**
 * Step one of both pickers: choose a league.
 *
 * The old picker listed all 62 teams at once behind a search box. Dean asked for a league
 * step first, which is also the only sane shape once a third league exists: the list of
 * leagues is short and stable, and every step after it is narrowed by the one before.
 *
 * `mode` decides where a league leads. Teams finish one step later; players have a team
 * step in between.
 *
 * A league has no colour of its own, so its tile is the person's.
 */
const LEAGUES = [
  { id: 'mlb', name: 'Major League Baseball', meta: '30 teams' },
  { id: 'nfl', name: 'National Football League', meta: '32 teams' },
];

export default function LeagueRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const players = mode === 'players';

  return (
    <SettingsFrame
      title={players ? 'Add a player' : 'Add a team'}
      fallback={players ? '/settings/favorites?tab=players' : '/settings/favorites'}
    >
      <SectionHeader title="Choose a league" />
      {LEAGUES.map((l) => (
        <PickRow
          key={l.id}
          badge={sportLabel(l.id)}
          title={l.name}
          meta={l.meta}
          chevron
          onPress={() =>
            router.push(
              players
                ? `/settings/favorites/players?sport=${l.id}`
                : `/settings/favorites/teams?sport=${l.id}`,
            )
          }
        />
      ))}
    </SettingsFrame>
  );
}
