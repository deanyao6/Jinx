import React from 'react';
import { StyleSheet, Text as HeroText, View } from 'react-native';

import { Button } from '@/components/Button';
import { TightText } from '@/components/reference/TightText';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

import { CurseShatter } from './CurseShatter';
import { EGG_SPORTS } from './live';
import { Flippable } from './RallyCap';
import { RewindableRecord } from './RecordRewind';
import { formatTally, replaySteps, type ReplayGame } from './rewind';
import { useEggPreview } from './store';

/**
 * What the dev page plays (Settings, About, Easter eggs). Nobody can summon a seventh inning or
 * a five-game losing streak on demand, so each egg is drawn here on sample data with a Play
 * button. These draw the real components; only the data is made up.
 */

/** W and L for a made-up twelve games: 8 and 4. */
const SAMPLE_RESULTS = 'WLWWLWWWLWLW';

const SAMPLE_GAMES: ReplayGame[] = SAMPLE_RESULTS.split('').map((letter, i) => {
  const home = i % 3 !== 0;
  const won = letter === 'W';
  return {
    gameId: `sample-${i}`,
    scheduledStart: new Date(Date.UTC(2025, 3 + Math.floor(i / 2), 4 + i * 2, 23, 5)).toISOString(),
    status: 'final',
    homeTeamId: home ? 'mine' : 'theirs',
    awayTeamId: home ? 'theirs' : 'mine',
    homeScore: home === won ? 5 : 2,
    awayScore: home === won ? 2 : 5,
    rootingTeamId: 'mine',
    homeAbbreviation: home ? 'PHI' : (['NYM', 'LAD', 'ATL', 'WSH'][i % 4] ?? 'NYM'),
    awayAbbreviation: home ? (['NYM', 'LAD', 'ATL', 'WSH'][i % 4] ?? 'NYM') : 'PHI',
  };
});

const SAMPLE_STEPS = replaySteps(SAMPLE_GAMES);
const SAMPLE_RECORD = formatTally(SAMPLE_STEPS[SAMPLE_STEPS.length - 1] ?? { w: 0, l: 0, t: 0 });

/** A stand-in for the Passport hero: the same dark card and the same condensed number. */
function MiniHero({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={s.hero}>
      <HeroText style={s.heroLabel}>{label}</HeroText>
      {children}
    </View>
  );
}

export function RewindPreview() {
  const [playKey, setPlayKey] = React.useState(0);
  return (
    <View style={s.preview}>
      <MiniHero label="SAMPLE RECORD, 12 GAMES">
        <View style={s.heroRecordRow}>
          <RewindableRecord
            record={SAMPLE_RECORD}
            steps={SAMPLE_STEPS}
            playKey={playKey}
            draw={(text) => (
              <TightText fontSize={64} lineHeight={0.78} style={s.heroRecord}>
                {text}
              </TightText>
            )}
          />
        </View>
      </MiniHero>
      <Button title="Play" variant="secondary" small onPress={() => setPlayKey((n) => n + 1)} />
    </View>
  );
}

export function CursePreview() {
  const [run, setRun] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  return (
    <View style={s.preview}>
      <MiniHero label="LIFETIME RECORD">
        <View style={s.heroRecordRow}>
          <TightText fontSize={64} lineHeight={0.78} style={s.heroRecord}>
            {SAMPLE_RECORD}
          </TightText>
        </View>
        <HeroText style={s.heroLast}>Last game: a win, at last</HeroText>
        {playing ? (
          <CurseShatter key={run} losses={6} seed={run * 7919} onDone={() => setPlaying(false)} />
        ) : null}
      </MiniHero>
      <Button
        title="Play"
        variant="secondary"
        small
        onPress={() => {
          setRun((n) => n + 1);
          setPlaying(true);
        }}
      />
    </View>
  );
}

export function RallyCapPreview() {
  const theme = useTheme();
  const [flipped, setFlipped] = React.useState(false);
  return (
    <View style={s.preview}>
      <View style={s.wordmark}>
        <Flippable flipped={flipped}>
          <TightText fontSize={32} lineHeight={0.85} style={[s.word, { color: theme.colors.ink }]}>
            JINX
          </TightText>
        </Flippable>
      </View>
      <Button
        title={flipped ? 'Flip back' : 'Play'}
        variant="secondary"
        small
        onPress={() => setFlipped((on) => !on)}
      />
    </View>
  );
}

/** One button per sport in the table, so a new sport's pieces are playable the day it is added. */
export function ConfettiPreview() {
  const play = useEggPreview((state) => state.playConfetti);
  return (
    <View style={[s.preview, { flexDirection: 'row', flexWrap: 'wrap' }]}>
      {Object.entries(EGG_SPORTS).map(([sport, row]) => (
        <Button
          key={sport}
          title={`Play ${sport.toUpperCase()}: ${row.signatureBreak.name.toLowerCase()}`}
          variant="secondary"
          small
          onPress={() => play(sport)}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  preview: { marginTop: 12, gap: 10, alignItems: 'flex-start' },
  // The Passport hero's own colours and radius. Pinned dark in both schemes, as the hero is.
  hero: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#121824',
    paddingTop: 13,
    paddingHorizontal: 15,
    paddingBottom: 12,
  },
  heroLabel: {
    fontSize: 9.5,
    fontFamily: fontFamily({ weight: 750 }),
    letterSpacing: 9.5 * 0.07,
    color: 'rgba(255,255,255,0.62)',
  },
  heroRecordRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 12, marginBottom: 14 },
  heroRecord: {
    fontFamily: fontFamily({ width: 62, weight: 900 }),
    letterSpacing: -64 * 0.01,
    color: '#FFFFFF',
  },
  heroLast: {
    fontSize: 11.5,
    fontFamily: fontFamily({ weight: 650 }),
    color: '#FFFFFF',
  },
  wordmark: { paddingVertical: 6 },
  word: { fontFamily: fontFamily({ width: 62, weight: 900 }), letterSpacing: 32 * 0.01 },
});
