import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { PageIntro } from '@/components/PageIntro';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import {
  useFavoriteGames,
  useMyAttendedGames,
  useRemoveFavoriteGame,
  useSetFavoriteGame,
  type FavoriteGame,
} from '@/features/communities/queries';
import { useTheme } from '@/theme/ThemeProvider';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Four favorite games (docs/prompts/social/04, section 6): pinned at the top of Profile and
 * Passport, chosen from the fan's own attended games, the first thing a visitor sees. */
export default function FourFavoritesRoute() {
  const favorites = useFavoriteGames();
  const setFavorite = useSetFavoriteGame();
  const removeFavorite = useRemoveFavoriteGame();
  const [pickingOrdinal, setPickingOrdinal] = useState<number | null>(null);

  const byOrdinal = new Map((favorites.data ?? []).map((f) => [f.ordinal, f]));
  const slots = [1, 2, 3, 4];

  return (
    <Screen>
      <PageIntro
        kicker="Like Letterboxd's Four Favorites"
        title="Four favorite games"
        body="Pick up to four games from your passport. They sit at the top of your profile, the first thing anyone sees."
      />
      {favorites.isPending ? <Loading /> : null}
      {favorites.isError ? <ErrorNotice error={favorites.error} onRetry={favorites.refetch} /> : null}

      {slots.map((ordinal) => {
        const fav = byOrdinal.get(ordinal);
        return (
          <FavoriteSlot
            key={ordinal}
            ordinal={ordinal}
            favorite={fav}
            onTap={() => setPickingOrdinal(ordinal)}
            onRemove={fav ? () => removeFavorite.mutate({ ordinal }) : undefined}
          />
        );
      })}

      {pickingOrdinal != null ? (
        <GamePicker
          onClose={() => setPickingOrdinal(null)}
          onPick={(gameId) => {
            setFavorite.mutate({ ordinal: pickingOrdinal, gameId });
            setPickingOrdinal(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

function FavoriteSlot({
  ordinal,
  favorite,
  onTap,
  onRemove,
}: {
  ordinal: number;
  favorite: FavoriteGame | undefined;
  onTap: () => void;
  onRemove?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onTap}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Card style={{ paddingVertical: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile icon="i-spark" solid={!!favorite} />
          <View style={{ flex: 1 }}>
            {favorite ? (
              <>
                <Text variant="bodyStrong">{favorite.matchup}</Text>
                <Text variant="caption" color="muted" style={{ marginTop: 1 }}>
                  {favorite.venue ? `${favorite.venue}, ` : ''}
                  {formatDate(favorite.date)}
                  {favorite.note ? ` · ${favorite.note}` : ''}
                </Text>
              </>
            ) : (
              <Text variant="bodyStrong" color="muted">
                Empty. Tap to pick a game.
              </Text>
            )}
          </View>
          {onRemove ? (
            <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={10}>
              <Text variant="caption" color="muted">
                Remove
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function GamePicker({ onClose, onPick }: { onClose: () => void; onPick: (gameId: string) => void }) {
  const theme = useTheme();
  const games = useMyAttendedGames();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = games.data ?? [];
    return q ? list.filter((g) => g.matchup.toLowerCase().includes(q)) : list;
  }, [games.data, query]);

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.screen,
        paddingTop: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <Text variant="h2" style={{ marginBottom: theme.spacing.sm }}>
        Pick a game
      </Text>
      <TextField
        placeholder="Search your games"
        value={query}
        onChangeText={setQuery}
        autoFocus
      />
      {games.isPending ? <Loading /> : null}
      {filtered.map((g) => (
        <Pressable
          key={g.game_id}
          accessibilityRole="button"
          onPress={() => onPick(g.game_id)}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 10 })}
        >
          <Text variant="bodyStrong">{g.matchup}</Text>
          <Text variant="caption" color="muted">
            {formatDate(g.date)}
          </Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={{ marginTop: theme.spacing.md, alignItems: 'center' }}
      >
        <Text color="accent" weight={750}>
          Cancel
        </Text>
      </Pressable>
    </View>
  );
}
