import { GOAL_TEMPLATES, type Sport } from '@jinx/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow } from '@/components/CheckRow';
import { Chip } from '@/components/Chip';
import { FormScreen } from '@/components/FormScreen';
import { Notice, errorMessage } from '@/components/Notice';
import { Row } from '@/components/Row';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { momentLabel } from '@/features/attendances/moments';
import {
  buildCustomGoal,
  buildTemplateGoal,
  customGoalTitle,
  EMPTY_CUSTOM_GOAL,
  templateNeedsN,
  type CustomGoalInput,
  type CustomGoalType,
} from '@/features/goals/builder';
import { useCreateGoal } from '@/features/goals/queries';
import { useFavoriteTeams } from '@/features/profile/queries';
import { currentSeason, sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

const EVENTS = [
  'home_run',
  'walk_off',
  'grand_slam',
  'no_hitter',
  'extra_innings',
  'shutout',
  'overtime',
  'pick_six',
  'comeback_14',
  'long_field_goal',
];

const CUSTOM_TYPES: { key: CustomGoalType; label: string }[] = [
  { key: 'count', label: 'Games' },
  { key: 'distinct_venues', label: 'Stadiums' },
  { key: 'exists', label: 'Once' },
];

function Stepper({
  value,
  onChange,
  min = 1,
  max = 500,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const btn = (label: 'remove' | 'add', delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'add' ? 'Increase' : 'Decrease'}
      onPress={() => onChange(Math.max(min, Math.min(max, value + delta)))}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.tint,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={label} size={20} color={c.ink} />
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        marginVertical: theme.spacing.sm,
      }}
    >
      {btn('remove', -1)}
      <Text
        variant="stat"
        style={{ minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      {btn('add', 1)}
    </View>
  );
}

export default function NewGoalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const year = currentSeason();
  const favorites = useFavoriteTeams();
  const create = useCreateGoal(year);

  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [templateKey, setTemplateKey] = useState<string>(GOAL_TEMPLATES[0]?.key ?? 'attend_n');
  const [n, setN] = useState<number>(GOAL_TEMPLATES[0]?.defaultN ?? 10);
  const [templateTeam, setTemplateTeam] = useState<string | null>(null);
  const [custom, setCustom] = useState<CustomGoalInput>(EMPTY_CUSTOM_GOAL);
  const [title, setTitle] = useState('');

  const franchises = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of favorites.data ?? [])
      if (!seen.has(t.franchise_id)) seen.set(t.franchise_id, t.name);
    return Array.from(seen.entries());
  }, [favorites.data]);
  const defaultTeam = franchises[0]?.[0];

  const draft = useMemo(() => {
    if (mode === 'template') {
      return buildTemplateGoal(templateKey, n, year, {
        favoriteFranchiseId: templateTeam ?? defaultTeam,
      });
    }
    return buildCustomGoal(custom, year, title);
  }, [mode, templateKey, n, year, templateTeam, defaultTeam, custom, title]);

  const pickTemplate = (key: string, defaultN: number) => {
    setTemplateKey(key);
    setN(defaultN);
  };

  const save = () => {
    if (!draft) return;
    create.mutate(draft, { onSuccess: () => router.back() });
  };

  const patch = (p: Partial<CustomGoalInput>) => setCustom((cur) => ({ ...cur, ...p }));

  return (
    <FormScreen>
      <Segmented
        options={[
          { key: 'template', label: 'Templates' },
          { key: 'custom', label: 'Build your own' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {create.isError ? <Notice tone="error">{errorMessage(create.error)}</Notice> : null}

      {mode === 'template' ? (
        <>
          <Card label="Pick a template">
            {GOAL_TEMPLATES.map((t, i) => {
              const on = t.key === templateKey;
              return (
                <Row
                  key={t.key}
                  first={i === 0}
                  title={t.title(on ? n : t.defaultN)}
                  onPress={() => pickTemplate(t.key, t.defaultN)}
                  accessibilityLabel={t.title(t.defaultN)}
                  right={
                    <Ionicons
                      name={on ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={on ? theme.colors.ink : theme.colors.muted}
                    />
                  }
                />
              );
            })}
          </Card>
          {templateNeedsN(templateKey) ? (
            <Card label="How many">
              <Stepper value={n} onChange={setN} />
            </Card>
          ) : null}
          {templateKey === 'team_on_road' && franchises.length > 1 ? (
            <Card label="Which team">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {franchises.map(([id, name]) => (
                  <Chip
                    key={id}
                    label={name}
                    selected={(templateTeam ?? defaultTeam) === id}
                    onPress={() => setTemplateTeam(id)}
                  />
                ))}
              </View>
            </Card>
          ) : null}
          {templateKey === 'team_on_road' && franchises.length === 0 ? (
            <Notice>
              Follow a team in your profile first so this goal knows who ‘your team’ is.
            </Notice>
          ) : null}
        </>
      ) : (
        <>
          <Card label="What counts">
            <Segmented
              options={CUSTOM_TYPES}
              value={custom.type}
              onChange={(type) => patch({ type })}
            />
            {custom.type !== 'exists' ? (
              <Stepper value={custom.target} onChange={(target) => patch({ target })} />
            ) : null}
            <Text variant="caption" color="muted">
              {custom.type === 'count'
                ? 'Number of games that match.'
                : custom.type === 'distinct_venues'
                  ? 'Number of different stadiums with a matching game.'
                  : 'Done the first time a matching game goes final.'}
            </Text>
          </Card>
          <Card label="Sport">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Chip
                label="Any"
                selected={custom.sport === null}
                onPress={() => patch({ sport: null })}
              />
              {(['mlb', 'nfl'] as Sport[]).map((sp) => (
                <Chip
                  key={sp}
                  label={sportLabel(sp)}
                  selected={custom.sport === sp}
                  onPress={() => patch({ sport: sp })}
                />
              ))}
            </View>
          </Card>
          <Card label="Moment in the game">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Chip
                label="Any"
                selected={custom.event === null}
                onPress={() => patch({ event: null })}
              />
              {EVENTS.map((ev) => (
                <Chip
                  key={ev}
                  label={momentLabel(ev)}
                  selected={custom.event === ev}
                  onPress={() => patch({ event: ev })}
                />
              ))}
            </View>
          </Card>
          <Card label="Your team">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Chip
                label="Any"
                selected={custom.team === null}
                onPress={() => patch({ team: null, teamName: null })}
              />
              {franchises.map(([id, name]) => (
                <Chip
                  key={id}
                  label={name}
                  selected={custom.team === id}
                  onPress={() => patch({ team: id, teamName: name })}
                />
              ))}
            </View>
            <CheckRow
              title="On the road"
              subtitle="Your side is the away team"
              checked={custom.road}
              onToggle={() => patch({ road: !custom.road })}
            />
            <CheckRow
              title="New stadium"
              subtitle="Your first visit to the venue"
              checked={custom.newVenue}
              onToggle={() => patch({ newVenue: !custom.newVenue })}
            />
          </Card>
          <TextField
            label="Title"
            placeholder={customGoalTitle(custom)}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />
        </>
      )}

      <Card label="Preview">
        <Text variant="bodyStrong">{draft?.title ?? 'Pick the options above'}</Text>
        <Text variant="caption" color="muted">
          {year} goal
        </Text>
      </Card>
      <Button title="Add goal" onPress={save} loading={create.isPending} disabled={!draft} />
    </FormScreen>
  );
}
