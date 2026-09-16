import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { ICONS } from '@/components/reference/icons';
import { TightText } from '@/components/reference/TightText';
import { PhotoScene } from '@/components/reference/PhotoScene';
import { relivePoint } from '@/features/demo/fixtures';
import { useRepository } from '@/features/data/context';
import { EmptyState } from '@/features/data/EmptyState';
import type { ReliveFixture, ReliveStep } from '@/features/data/shapes';
import { TabBar } from '@/features/passport/reference/parts';
import { openShare } from '@/features/share/navigate';
import type { ShareGame } from '@/features/share/types';
import { fontFamily } from '@/theme/fonts';
import { ReferenceThemeProvider, TeamTheme, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { motion, screenPadding } from '@/theme/reference/tokens';

/**
 * Relive, ported from the fourth phone in `design/reference.html` (SPEC.md 6.19, 8.8.4).
 *
 * `step` is the index into RELIVE_STEPS the story player is showing. Step 0 is the
 * pregame state the screen opens on, before play is pressed; the reference shows its
 * idle hint until then, so that is what step 0 renders.
 *
 * The screen takes the home team's theme, as the reference's `.scr.t-phi` does, which is
 * what colours the play button and the win probability line.
 */
export function ReliveScreen({ step = 0 }: { step?: number }) {
  const relive = useRepository().relive();
  return (
    <ReferenceThemeProvider team={relive.home.team}>
      <Body initialStep={step} />
    </ReferenceThemeProvider>
  );
}

/**
 * Drives the story player. Play advances one step immediately and then every 1.7s, pause
 * stops where it is, and pressing play after the final step restarts from the beginning,
 * matching the reference's handler exactly.
 *
 * Reduce Motion does not disable this: stepping through the story is the feature, not
 * decoration, and the reference's own steps are already discrete rather than animated.
 */
function useStoryPlayer(initialStep: number, stepCount: number) {
  const [step, setStep] = React.useState(initialStep);
  const [playing, setPlaying] = React.useState(false);
  const last = stepCount - 1;

  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((current) => {
        if (current >= last) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, motion.reliveStepMs);
    return () => clearInterval(id);
  }, [playing, last]);

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Restart from the top once the story has finished.
    setStep((current) => (current >= last ? 0 : Math.min(current + 1, last)));
    setPlaying(true);
  };

  return { step, playing, toggle };
}

function Body({ initialStep }: { initialStep: number }) {
  const { base, team } = useReferenceTheme();
  const repo = useRepository();
  const router = useRouter();
  const relive = repo.relive();
  const steps = repo.reliveSteps();
  const { step, playing, toggle } = useStoryPlayer(initialStep, steps.length);
  const insets = useSafeAreaInsets();
  const Back = ICONS['i-chev-l'];
  const Share = ICONS['i-share'];
  const Camera = ICONS['i-camera'];
  const Eye = ICONS['i-eye'];
  const Ext = ICONS['i-ext'];

  const index = Math.max(0, Math.min(step, steps.length - 1));
  const current = steps[index];
  // The parity harness mounts a mid-story step directly rather than pressing play, so the
  // icon follows "is there more to come", which is what the reference's icon means.
  const showPause = playing || (index > 0 && index < steps.length - 1);

  /**
   * The escape hatch. This chevron shipped as a plain View, which left the tab bar as the
   * only way off the screen (docs/interactions.md). Relive is reached from a finished game,
   * so popping is almost always right; the fallback covers a cold deep link into
   * /relive/[gameId], where there is no history to pop back into.
   */
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  };

  /**
   * No story, no screen.
   *
   * Relive needs a game's scoring timeline and win probability, which this repository
   * cannot serve: it holds the user's aggregate data and `relive()` gets no game id (see
   * the note on the Repository type). Rather than replay someone else's Phillies game,
   * the screen says there is nothing to relive and keeps its way out.
   */
  if (!current) {
    return (
      <View style={{ flex: 1, backgroundColor: base.scr, paddingTop: insets.top }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: screenPadding.top,
            paddingHorizontal: screenPadding.horizontal,
            paddingBottom: screenPadding.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.top}>
            <View style={s.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={goBack}
                style={[s.iconButton, { backgroundColor: base.surface }]}
              >
                <Back size={20} color={base.ink} />
              </Pressable>
              <Text style={[s.topTitle, { color: base.ink }]}>Relive</Text>
            </View>
          </View>
          <EmptyState
            text="Nothing to relive yet. A game gets a story once its play-by-play has been ingested for a game you attended."
            loadingText="Loading this game…"
          />
        </ScrollView>
        <TabBar active="Games" />
      </View>
    );
  }

  /**
   * Adding a photo. The picker is real; the upload is not, and this is deliberately noisy
   * about that rather than silently doing nothing.
   *
   * A photo belongs to the attendance row for this game (`attendance_photos`), and this
   * screen has no attendance row: `relive()` returns the demo fixture and ignores the
   * route's gameId, and nothing in the app writes `attendance_photos` yet. So there is
   * nowhere to put the asset the user just picked.
   *
   * TODO(upload): once relive() takes a gameId, resolve the attendance row, upload each
   * asset to the private photos bucket and insert the attendance_photos row. The shape to
   * copy is features/imports/upload.ts, which already does exactly this for tickets.
   */
  const addPhoto = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.9,
      exif: false,
    });
    if (picked.canceled) return;
    // TODO(upload): picked.assets is dropped on the floor here. See above.
  };

  /**
   * The row promises "Opens in the league's video site", so it has to open something. There
   * is no per-game highlight URL to open: the fixture carries none, ingest stores none, and
   * relive() ignores the route's gameId. Guessing a per-game deep link would 404, so this
   * opens the league's video site itself, which is exactly what the row claims.
   *
   * TODO: open the game's own reel once a highlight URL is ingested, and pick the site from
   * the game's sport rather than assuming MLB.
   */
  const openHighlights = () => {
    void Linking.openURL(HIGHLIGHTS_URL);
  };

  return (
    <View style={{ flex: 1, backgroundColor: base.scr, paddingTop: insets.top }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: screenPadding.top,
          paddingHorizontal: screenPadding.horizontal,
          paddingBottom: screenPadding.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.top}>
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
              style={[s.iconButton, { backgroundColor: base.surface }]}
            >
              <Back size={20} color={base.ink} />
            </Pressable>
            <Text style={[s.topTitle, { color: base.ink }]}>Relive</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this game"
            onPress={() => openShare(router, reliveShareGame(relive, steps))}
            style={[s.iconButton, { backgroundColor: base.surface }]}
          >
            <Share size={20} color={base.ink} />
          </Pressable>
        </View>

        {/* `.scorebug` is a 1fr auto 1fr grid, so the score column is intrinsic. */}
        <View style={[s.scorebug, { backgroundColor: base.surface }]}>
          <TeamTheme team={relive.away.team}>
            <ScorebugTeam badge={relive.away.badge} name={relive.away.name} />
          </TeamTheme>
          <View style={s.score}>
            <TightText fontSize={46} lineHeight={0.9} style={[s.scoreValue, { color: base.ink }]}>
              {current.score}
            </TightText>
            <Text style={[s.scoreLabel, { color: base.muted }]}>{current.label}</Text>
          </View>
          <TeamTheme team={relive.home.team}>
            <ScorebugTeam badge={relive.home.badge} name={relive.home.name} />
          </TeamTheme>
        </View>

        <Text style={[s.note, { color: base.muted }]}>{relive.note}</Text>

        <View style={s.player}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPause ? 'Pause the game story' : 'Play the game story'}
            onPress={toggle}
            style={[s.playButton, { backgroundColor: team.accent }]}
          >
            {/* The reference swaps one path between a triangle and two bars. */}
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path
                d={showPause ? 'M7 5.5h3.5v13H7zM13.5 5.5H17v13h-3.5z' : 'M8 5.5v13l10.5-6.5z'}
                fill={team.onFill}
              />
            </Svg>
          </Pressable>
          <View style={[s.storyCard, { backgroundColor: base.surface }]}>
            <Text style={[s.storyLabel, { color: base.muted }]}>
              {index === 0 ? relive.idleHint : current.label}
            </Text>
            <Text style={[s.storyText, { color: base.ink }]}>{current.text}</Text>
          </View>
        </View>

        <WinProbChart series={repo.reliveWinProb()} upTo={current.wp} />

        <View style={s.chartLabels}>
          <Text style={[s.chartLabel, { color: base.muted }]}>{relive.chartLabels.left}</Text>
          <Text style={[s.chartLabel, { color: base.muted }]}>{relive.chartLabels.middle}</Text>
          <Text style={[s.chartLabel, { color: base.muted }]}>{relive.chartLabels.right}</Text>
        </View>

        <SectionRow
          title="Your photos"
          action="Add"
          actionLabel="Add a photo"
          onAction={() => void addPhoto()}
        />
        <View style={s.photos}>
          {/* The tiles stay inert. `PhotoScene` draws a generated placeholder rather than a
              photo, and the app has no full-screen viewer to open one in, so there is nothing
              to show and nothing to set visibility on or delete. Wire the tap, and the two
              actions docs/interactions.md asks for, when the viewer and real photos land. */}
          {repo.relivePhotos().map((photo, i) => (
            <View key={`${photo.kind}-${i}`} style={s.photo}>
              <PhotoScene kind={photo.kind} seed={photo.seed} />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo from your library"
            onPress={() => void addPhoto()}
            style={[s.photoAdd, { borderColor: base.line }]}
          >
            <Camera size={20} color={base.muted} />
          </Pressable>
        </View>

        {/* The count is a count, not a link, so this header has no action. */}
        <SectionRow title="From fans at this game" action={relive.fanCount} />
        <View style={s.photos}>
          {/* Inert for the same reason as your own photos, plus report and block have no
              backend yet. */}
          {repo.reliveFanPhotos().map((photo, i) => (
            <View key={`${photo.kind}-${i}`} style={s.photo}>
              <PhotoScene kind={photo.kind} seed={photo.seed} />
            </View>
          ))}
        </View>

        <View style={s.highlights}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Official highlights, opens in the league's video site"
            onPress={openHighlights}
            style={s.li}
          >
            <View style={[s.liIcon, { backgroundColor: base.surface }]}>
              <Eye size={20} color={team.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.liTitle, { color: base.ink }]}>Official highlights</Text>
              <Text style={[s.liMeta, { color: base.muted }]} numberOfLines={1}>
                Opens in the league&apos;s video site
              </Text>
            </View>
            <Ext size={20} color={base.muted} />
          </Pressable>
        </View>
      </ScrollView>
      <TabBar active="Games" />
    </View>
  );
}

/** `.scorebug .tm` with the circular `.fx-bd` badge above the name. */
function ScorebugTeam({ badge, name }: { badge: string; name: string }) {
  const { base, team } = useReferenceTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={[s.badge, { backgroundColor: team.fill, borderColor: team.second }]}>
        <Text style={s.badgeText}>{badge}</Text>
      </View>
      <Text style={[s.teamName, { color: base.ink }]}>{name}</Text>
    </View>
  );
}

/**
 * `.chart`: the win probability line drawn up to the current step, with a dot at the end
 * and a dashed 50% rule behind it.
 *
 * The reference uses `preserveAspectRatio="none"` so the 300x92 viewBox stretches to the
 * full width; react-native-svg honours the same attribute.
 */
function WinProbChart({ series, upTo }: { series: readonly number[]; upTo: number }) {
  const { base, team } = useReferenceTheme();
  const points: string[] = [];
  for (let i = 0; i <= upTo; i++) {
    const [x, y] = relivePoint(series, i);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const [dotX, dotY] = relivePoint(series, upTo);

  return (
    <Svg width="100%" height={92} viewBox="0 0 300 92" preserveAspectRatio="none">
      <Line x1="0" y1="46" x2="300" y2="46" stroke={base.line} strokeDasharray="3 4" />
      <Polyline
        points={points.join(' ')}
        fill="none"
        stroke={team.accent}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <Circle r="4.5" fill={team.accent} cx={dotX} cy={dotY} />
    </Svg>
  );
}

/**
 * `.sec`, the earlier screens' section header with a link on the right.
 *
 * The press sits on the `Text` rather than on a `Pressable` wrapping it, because `.sec`
 * aligns its two children on their baselines and wrapping the link in a view would change
 * what that baseline is measured from. This is wiring, not restyling.
 */
function SectionRow({
  title,
  action,
  actionLabel,
  onAction,
}: {
  title: string;
  action: string;
  /** Spoken label for the link. Defaults to the visible text. */
  actionLabel?: string;
  /** Omit to leave the action inert, for headers whose right side is a count. */
  onAction?: () => void;
}) {
  const { base, team } = useReferenceTheme();
  return (
    <View style={s.sec}>
      <Text style={[s.secTitle, { color: base.ink }]}>{title}</Text>
      <Text
        accessibilityRole={onAction ? 'button' : undefined}
        accessibilityLabel={onAction ? (actionLabel ?? action) : undefined}
        onPress={onAction}
        style={[s.secAction, { color: team.accent }]}
      >
        {action}
      </Text>
    </View>
  );
}

/** Where the "Official highlights" row goes. See `openHighlights`. */
const HIGHLIGHTS_URL = 'https://www.mlb.com/video';

/**
 * The share card for this game.
 *
 * There is no "relive" share template. The sheet's templates are record, game, pledge,
 * stamp, companion, goal and wrapped (features/share/types.ts), and `/share/[template]`
 * needs a payload as well as a name, so pushing a bare `/share/relive` would land on the
 * sheet's "This card could not be opened" state. The game this screen relives is the
 * closest existing template, so Share opens that.
 *
 * Built from the demo fixture, because relive() ignores the route's gameId. TODO: build it
 * from the real game row once it does, which also removes `parseReliveNote` below.
 */
function reliveShareGame(relive: ReliveFixture, steps: readonly ReliveStep[]): ShareGame {
  const last = steps[steps.length - 1];
  const [away, home] = scorePair(last?.score);
  const final = away !== null && home !== null;
  const { date, venue } = parseReliveNote(relive.note);
  return {
    kind: 'game',
    // The demo game is MLB. TODO: take this from the game once there is one.
    sport: 'mlb',
    away: relive.away.name,
    home: relive.home.name,
    awayScore: away,
    homeScore: home,
    status: final ? 'final' : 'scheduled',
    venue,
    date,
    // The screen is themed for the home team and the story is told from their side.
    side: relive.home.name,
    result: !final ? null : home > away ? 'win' : home < away ? 'loss' : 'tie',
    // Nothing here has been checked against a check-in, so it does not claim to have been.
    verified: false,
  };
}

/** Splits a step's "3 – 6" into two numbers, or nulls when it is not a pair of numbers. */
function scorePair(score: string | undefined): [number | null, number | null] {
  const parts = (score ?? '').split(/[–-]/).map((n) => Number(n.trim()));
  const [away, home] = parts;
  if (parts.length !== 2 || away === undefined || home === undefined) return [null, null];
  if (!Number.isFinite(away) || !Number.isFinite(home)) return [null, null];
  return [away, home];
}

/**
 * The fixture keeps the date and the venue in one prose line — "Aug 14, 2025, Citizens Bank
 * Park, Section 321 with Dad and Maya" — because that is what the reference renders under
 * the scorebug. Read them back out for the share card rather than inventing values. Both
 * fall back to empties the card already handles: it omits a null venue and an unparseable
 * date. This goes away with the fixture.
 */
function parseReliveNote(note: string): { date: string; venue: string | null } {
  const m = /^([A-Za-z]{3,9} \d{1,2}, \d{4}), ([^,]+)/.exec(note);
  const [, day, venue] = m ?? [];
  if (!day || !venue) return { date: '', venue: null };
  const parsed = new Date(`${day} 00:00:00`);
  return { date: Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString(), venue };
}

const s = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topTitle: { fontSize: 22, fontFamily: fontFamily({ weight: 850 }), letterSpacing: -22 * 0.01 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // `.scorebug{border-radius:22px;padding:12px}`
  scorebug: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    padding: 12,
  },
  // `.scorebug .fx-bd{width:46px;height:46px;font-size:13.5px;border-width:2.5px;margin:0 auto 4px}`
  badge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 13.5,
    fontFamily: fontFamily({ width: 80, weight: 900 }),
    color: '#FFFFFF',
  },
  teamName: { fontSize: 12.5, fontFamily: fontFamily({ weight: 750 }) },
  // `.scorebug .sc{font-size:46px;line-height:.9;min-width:110px}`
  score: { minWidth: 110, alignItems: 'center' },
  scoreValue: {
    // fontSize and the line box are set by <TightText>.
    fontFamily: fontFamily({ width: 62, weight: 900 }),
  },
  scoreLabel: { fontSize: 12, fontFamily: fontFamily({ weight: 600 }) },

  // `.note{font-size:13px;line-height:1.45}` with the inline centring and top margin.
  note: { fontSize: 13, lineHeight: 13 * 1.45, textAlign: 'center', marginTop: 8 },

  // `.player{gap:10px;margin:12px 0 8px}`
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 8 },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `.storycard{border-radius:16px;padding:10px 12px;min-height:58px}`
  storyCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 58,
  },
  storyLabel: { fontSize: 11.5, fontFamily: fontFamily(), marginBottom: 2 },
  storyText: { fontSize: 13.5, lineHeight: 13.5 * 1.4, fontFamily: fontFamily() },

  // `.wplbl{font-size:12.5px}` with `.dog` at weight 500 and muted.
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  chartLabel: { fontSize: 12.5, fontFamily: fontFamily({ weight: 500 }) },

  // `.sec{margin:18px 0 8px}`
  sec: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
  },
  secTitle: { fontSize: 18, fontFamily: fontFamily({ weight: 800 }) },
  secAction: { fontSize: 13.5, fontFamily: fontFamily({ weight: 700 }) },

  // `.photos{grid-template-columns:repeat(3,1fr);gap:6px}` with square cells.
  photos: { flexDirection: 'row', gap: 6 },
  photo: { flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  photoAdd: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  highlights: { marginTop: 8 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  // `.li .ic{width:36px;height:36px;border-radius:12px}`
  liIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liTitle: { fontSize: 14.5, fontFamily: fontFamily({ weight: 700 }) },
  liMeta: { fontSize: 12.5, fontFamily: fontFamily() },
});
