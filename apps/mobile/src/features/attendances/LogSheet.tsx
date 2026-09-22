import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow } from '@/components/CheckRow';
import { FormScreen } from '@/components/FormScreen';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useGame, type GameDetail } from '@/features/games/queries';
import { shortTeamName } from '@/features/data/names';
import { Scoreboard } from '@/features/games/ui/Scoreboard';
import { SideTheme } from '@/features/games/ui/SideTheme';
import { FollowedCompanions } from '@/features/people/FollowedCompanions';
import { useAddPerson, usePeople } from '@/features/people/queries';
import { useFavoriteTeams } from '@/features/profile/queries';
import {
  doubleheaderLabel,
  formatGameDateLong,
  formatPriceCents,
  parsePriceToCents,
} from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import {
  useLogAttendance,
  useMyAttendanceForGame,
  useUpdateAttendance,
  type Attendance,
} from './queries';
import { attendanceStatusFor, resolveRooting } from './rooting';

type Props = { gameId: string };

/** Loads the game and any existing attendance, then renders the form with those as initial values. */
export function LogSheet({ gameId }: Props) {
  const game = useGame(gameId);
  const existing = useMyAttendanceForGame(gameId);
  if (game.isPending || existing.isPending) return <Loading label="Loading game" />;
  if (game.isError || !game.data) {
    return (
      <FormScreen>
        <ErrorNotice
          error={game.error}
          message="Could not load this game."
          onRetry={game.refetch}
        />
      </FormScreen>
    );
  }
  return <LogForm gameId={gameId} game={game.data} existing={existing.data ?? null} />;
}

type FormProps = { gameId: string; game: GameDetail; existing: Attendance | null };

function LogForm({ gameId, game: g, existing }: FormProps) {
  const theme = useTheme();
  const router = useRouter();
  const favorites = useFavoriteTeams();
  const people = usePeople();
  const addPerson = useAddPerson();
  const log = useLogAttendance();
  const update = useUpdateAttendance();

  const [section, setSection] = useState(existing?.seat?.section ?? '');
  const [row, setRow] = useState(existing?.seat?.row ?? '');
  const [seat, setSeat] = useState(existing?.seat?.seat ?? '');
  const [price, setPrice] = useState(
    existing?.seat?.price_cents != null
      ? (formatPriceCents(existing.seat.price_cents) ?? '').replace('$', '')
      : '',
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [companions, setCompanions] = useState<Set<string>>(
    () =>
      new Set(
        (existing?.companions ?? []).map((x) => x.person?.id).filter((id): id is string => !!id),
      ),
  );
  const [newPerson, setNewPerson] = useState('');
  const [chosenTeamId, setChosenTeamId] = useState<string | null>(
    existing?.rooting_basis === 'chosen' ? existing.rooting_team_id : null,
  );

  const rooting = useMemo(() => {
    if (!g.home || !g.away) return null;
    return resolveRooting({
      home: g.home,
      away: g.away,
      favorites: favorites.data ?? [],
      chosenTeamId,
    });
  }, [g, favorites.data, chosenTeamId]);

  const isEdit = !!existing;
  const saving = log.isPending || update.isPending;
  const error = log.error ?? update.error;

  const toggleCompanion = (id: string) => {
    setCompanions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onAddPerson = async () => {
    const name = newPerson.trim();
    if (!name) return;
    const person = await addPerson.mutateAsync(name);
    setCompanions((prev) => new Set(prev).add(person.id));
    setNewPerson('');
  };

  const onSave = async () => {
    if (!rooting) return;
    const input = {
      gameId,
      status: attendanceStatusFor(g),
      rootingTeamId: rooting.teamId,
      rootingBasis: rooting.basis,
      note,
      seat: { section, row, seat, priceCents: parsePriceToCents(price) },
      companionIds: [...companions],
    };
    try {
      if (existing) {
        await update.mutateAsync({ ...input, attendanceId: existing.id });
        router.back();
      } else {
        await log.mutateAsync(input);
        router.replace(`/games/${gameId}`);
      }
    } catch {
      // surfaced via mutation error
    }
  };

  const status = attendanceStatusFor(g);
  const dh = doubleheaderLabel(g.doubleheader_number);

  return (
    <FormScreen headerOffset={60}>
      <Scoreboard
        away={{
          teamId: g.away?.id ?? null,
          abbreviation: g.away?.abbreviation,
          name: g.away ? shortTeamName(g.away.name, { nickname: g.away.nickname }) : 'Away',
          ...(g.status === 'final' ? { score: String(g.away_score ?? 0) } : {}),
        }}
        home={{
          teamId: g.home?.id ?? null,
          abbreviation: g.home?.abbreviation,
          name: g.home ? shortTeamName(g.home.name, { nickname: g.home.nickname }) : 'Home',
          ...(g.status === 'final' ? { score: String(g.home_score ?? 0) } : {}),
        }}
        winner={
          g.status !== 'final' || g.home_score == null || g.away_score == null
            ? null
            : g.winner_team_id
              ? g.winner_team_id === g.home_team_id
                ? 'home'
                : 'away'
              : g.home_score > g.away_score
                ? 'home'
                : g.away_score > g.home_score
                  ? 'away'
                  : null
        }
        status={[g.status === 'final' ? 'Final' : null, formatGameDateLong(g.scheduled_start), dh]
          .filter(Boolean)
          .join(' · ')}
        venue={g.venue?.name ?? null}
      />

      {g.status === 'postponed' && g.rescheduled_to_game_id ? (
        <Notice>
          <Text variant="sub" style={{ marginBottom: theme.spacing.sm }}>
            This game was postponed. Log the makeup game instead?
          </Text>
          <Button
            title="Go to the makeup game"
            variant="primary"
            small
            onPress={() => router.replace(`/games/log/${g.rescheduled_to_game_id}`)}
            style={{ alignSelf: 'flex-start' }}
          />
        </Notice>
      ) : g.status === 'postponed' || g.status === 'cancelled' ? (
        <Notice>
          This game was {g.status}. You can still log it, but it will not count toward your record.
        </Notice>
      ) : null}

      {status === 'going' ? (
        <Notice tone="success">This game has not started. Saving marks you as Going.</Notice>
      ) : null}

      {error ? <Notice tone="error">{errorMessage(error)}</Notice> : null}

      {rooting?.bothFavorites && g.home && g.away ? (
        <Card label="You follow both. Who are you rooting for?">
          <View style={{ gap: theme.spacing.sm }}>
            {[g.away, g.home].map((t) => {
              const on = chosenTeamId === t.id;
              return (
                <SideTheme key={t.id} team={t.id}>
                  <RootingOption
                    name={t.name}
                    selected={on}
                    onPress={() => setChosenTeamId(t.id)}
                  />
                </SideTheme>
              );
            })}
          </View>
          <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
            Skip this and the game stays neutral for your record.
          </Text>
        </Card>
      ) : rooting?.teamId ? (
        <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.md }}>
          Counts for your {rooting.teamId === g.home?.id ? g.home?.name : g.away?.name} record.
        </Text>
      ) : null}

      <Card label="Who came with you">
        {people.isPending ? <Loading /> : null}
        {(people.data ?? []).map((p, i) => (
          <CheckRow
            key={p.id}
            title={p.display_name}
            checked={companions.has(p.id)}
            onToggle={() => toggleCompanion(p.id)}
            first={i === 0}
          />
        ))}
        {people.data && people.data.length === 0 ? (
          <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.sm }}>
            Add the people you go to games with. They do not need the app.
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.sm,
            alignItems: 'flex-start',
            marginTop: theme.spacing.sm,
          }}
        >
          <TextField
            placeholder="Add someone, like Dad"
            value={newPerson}
            onChangeText={setNewPerson}
            autoCapitalize="words"
            containerStyle={{ flex: 1, marginBottom: 0 }}
            returnKeyType="done"
            onSubmitEditing={onAddPerson}
            maxLength={40}
            accessibilityLabel="Add a person"
          />
          <Button
            title="Add"
            variant="secondary"
            onPress={onAddPerson}
            disabled={!newPerson.trim()}
            loading={addPerson.isPending}
          />
        </View>
        <FollowedCompanions
          people={people.data ?? []}
          onPick={(id) => setCompanions((prev) => new Set(prev).add(id))}
        />
      </Card>

      <Card label="Seat">
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <TextField
            label="Section"
            value={section}
            onChangeText={setSection}
            placeholder="121"
            containerStyle={{ flex: 1 }}
            autoCapitalize="characters"
          />
          <TextField
            label="Row"
            value={row}
            onChangeText={setRow}
            placeholder="14"
            containerStyle={{ flex: 1 }}
            autoCapitalize="characters"
          />
          <TextField
            label="Seat"
            value={seat}
            onChangeText={setSeat}
            placeholder="7"
            containerStyle={{ flex: 1 }}
            autoCapitalize="characters"
          />
        </View>
        <TextField
          label="Price"
          prefix="$"
          value={price}
          onChangeText={setPrice}
          placeholder="0"
          keyboardType="decimal-pad"
          containerStyle={{ marginBottom: 0 }}
        />
      </Card>

      <Card label="Note">
        <TextField
          value={note}
          onChangeText={setNote}
          placeholder="Anything you want to remember"
          multiline
          maxLength={1000}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
          containerStyle={{ marginBottom: 0 }}
          accessibilityLabel="Note"
        />
      </Card>

      <Button
        title={isEdit ? 'Save changes' : status === 'going' ? 'I’m going' : 'Log this game'}
        onPress={onSave}
        loading={saving}
        style={{ marginTop: theme.spacing.sm }}
      />
    </FormScreen>
  );
}

/** One side of "who are you rooting for", in that team's own colour: washed, or solid once picked. */
function RootingOption({
  name,
  selected,
  onPress,
}: {
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? theme.accent.fill : theme.accent.wash,
        borderRadius: theme.radius.lg,
        paddingVertical: 12,
        paddingHorizontal: 16,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text variant="h2" style={{ color: selected ? theme.accent.onFill : theme.accent.text }}>
        {name}
      </Text>
    </Pressable>
  );
}
