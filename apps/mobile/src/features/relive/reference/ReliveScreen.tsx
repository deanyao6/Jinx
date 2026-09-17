import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

import { PhotoViewer } from '../PhotoViewer';
import { fanCountLabel, pickMedia, useAddPhotos, useGamePhotos, type GamePhoto } from '../photos';
import { useReliveGame } from '../useReliveGame';

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
export function ReliveScreen({ step = 0, gameId }: { step?: number; gameId?: string }) {
  // Two sources on purpose. With a gameId this is one real game, read from the database;
  // without one it is whatever the repository holds, which is the reference's fixture in
  // demo mode and the empty state otherwise. The parity harness mounts the second form.
  const repo = useRepository();
  const perGame = useReliveGame(gameId);
  const relive = gameId ? perGame.relive : repo.relive();
  return (
    <ReferenceThemeProvider team={relive.home.team}>
      <Body
        initialStep={step}
        relive={relive}
        steps={gameId ? perGame.steps : repo.reliveSteps()}
        winProb={gameId ? perGame.winProb : repo.reliveWinProb()}
        isPending={gameId ? perGame.isPending : false}
        real={
          gameId
            ? {
                gameId,
                attendanceId: perGame.attendanceId,
                highlights: perGame.highlights,
                shareGame: perGame.shareGame,
              }
            : undefined
        }
      />
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
/**
 * The photo strip is a fixed four-column row, as the reference draws it.
 *
 * Every tile is `flex: 1, aspectRatio: 1`, so a row with fewer than four children stretches
 * them: a user with no photos got a single full-width square where the reference has a small
 * dashed tile. The spacers keep the columns honest without hard-coding a width against the
 * screen, which would have to know about the screen padding and the gap.
 */
const PHOTO_COLUMNS = 4;

function RowSpacers({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={s.photoSpacer} />
      ))}
    </>
  );
}

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

function Body({
  initialStep,
  relive,
  steps,
  winProb,
  isPending,
  real,
}: {
  initialStep: number;
  relive: ReliveFixture;
  steps: readonly ReliveStep[];
  winProb: readonly number[];
  isPending: boolean;
  /** Set for a real game. Without it the photo strips are the reference's fixtures. */
  real?: RealGame;
}) {
  const { base, team } = useReferenceTheme();
  const repo = useRepository();
  const router = useRouter();
  const { step, playing, toggle } = useStoryPlayer(initialStep, steps.length);
  const insets = useSafeAreaInsets();
  const Back = ICONS['i-chev-l'];
  const Share = ICONS['i-share'];
  const Camera = ICONS['i-camera'];
  const Eye = ICONS['i-eye'];
  const Ext = ICONS['i-ext'];

  const myPhotos = repo.relivePhotos();
  const fanPhotos = repo.reliveFanPhotos();

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
   * A game only has one once its play-by-play has been ingested and turned into story
   * steps, which the detail worker does after the game goes final (SPEC.md 4.7). Until
   * then, and for a screen opened with no gameId at all, this says so and keeps its way
   * out rather than replaying someone else's game.
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
            loading={isPending}
          />
        </ScrollView>
        <TabBar active="Games" />
      </View>
    );
  }

  // A real game opens its own page on its own league's site. The fixture has no game, so the
  // parity and demo build opens the league hub, which is all it can honestly point at.
  const highlightsUrl = real?.highlights.url ?? HIGHLIGHTS_URL;
  const highlightsMeta = real?.highlights.meta ?? "Opens in the league's video site";
  const openHighlights = () => {
    void Linking.openURL(highlightsUrl);
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
            onPress={() => openShare(router, real?.shareGame ?? reliveShareGame(relive, steps))}
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

        <WinProbChart series={winProb} upTo={current.wp} />

        <View style={s.chartLabels}>
          <Text style={[s.chartLabel, { color: base.muted }]}>{relive.chartLabels.left}</Text>
          <Text style={[s.chartLabel, { color: base.muted }]}>{relive.chartLabels.middle}</Text>
          <Text style={[s.chartLabel, { color: base.muted }]}>{relive.chartLabels.right}</Text>
        </View>

        {real ? (
          <RealPhotos game={real} />
        ) : (
          <>
            <SectionRow
              title="Your photos"
              action="Add"
              actionLabel="Add a photo"
              onAction={() => {}}
            />
            <View style={s.photos}>
              {/* The tiles stay inert. `PhotoScene` draws a generated placeholder rather than a
                photo, and the app has no full-screen viewer to open one in, so there is nothing
                to show and nothing to set visibility on or delete. Wire the tap, and the two
                actions docs/interactions.md asks for, when the viewer and real photos land. */}
              {myPhotos.map((photo, i) => (
                <View key={`${photo.kind}-${i}`} style={s.photo}>
                  <PhotoScene kind={photo.kind} seed={photo.seed} />
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a photo from your library"
                onPress={() => {}}
                style={[s.photoAdd, { borderColor: base.line }]}
              >
                <Camera size={20} color={base.muted} />
              </Pressable>
              <RowSpacers count={PHOTO_COLUMNS - myPhotos.length - 1} />
            </View>

            {/* The whole section is omitted when nobody has posted, rather than drawn as an
              empty strip under a header with no count. */}
            {fanPhotos.length > 0 ? (
              <>
                {/* The count is a count, not a link, so this header has no action. */}
                <SectionRow title="From fans at this game" action={relive.fanCount} />
                <View style={s.photos}>
                  {/* Inert for the same reason as your own photos, plus report and block have no
                    backend yet. */}
                  {fanPhotos.map((photo, i) => (
                    <View key={`${photo.kind}-${i}`} style={s.photo}>
                      <PhotoScene kind={photo.kind} seed={photo.seed} />
                    </View>
                  ))}
                  <RowSpacers count={PHOTO_COLUMNS - fanPhotos.length} />
                </View>
              </>
            ) : null}
          </>
        )}

        <View style={s.highlights}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Official highlights. ${highlightsMeta}`}
            onPress={openHighlights}
            style={s.li}
          >
            <View style={[s.liIcon, { backgroundColor: base.surface }]}>
              <Eye size={20} color={team.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.liTitle, { color: base.ink }]}>Official highlights</Text>
              <Text style={[s.liMeta, { color: base.muted }]} numberOfLines={1}>
                {highlightsMeta}
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

type RealGame = {
  gameId: string;
  attendanceId: string | undefined;
  highlights: { url: string; meta: string };
  shareGame: ShareGame | null;
};

/**
 * "Your photos" and "From fans at this game" for a real game (SPEC.md 6.19).
 *
 * The same two strips the reference draws, filled from `attendance_photos`. Uploads go to the
 * private bucket as followers-only, each tile opens a viewer where the owner sets visibility or
 * deletes, and a fan's tile opens the same viewer with report and block instead.
 */
function RealPhotos({ game }: { game: RealGame }) {
  const { base } = useReferenceTheme();
  const Camera = ICONS['i-camera'];
  const photos = useGamePhotos(game.gameId, game.attendanceId);
  const add = useAddPhotos(game.gameId, game.attendanceId);
  const [open, setOpen] = React.useState<{ photo: GamePhoto; mine: boolean } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const mine = photos.data?.mine ?? [];
  const fans = photos.data?.fans ?? [];
  const canAdd = !!game.attendanceId;

  const onAdd = async () => {
    setNotice(null);
    if (!canAdd) {
      setNotice('Log this game first, then you can add photos to it.');
      return;
    }
    try {
      const picked = await pickMedia();
      if (picked.length === 0) return;
      const outcome = await add.mutateAsync(picked);
      if (outcome.problems.length > 0) setNotice(outcome.problems[0] ?? null);
    } catch {
      setNotice('Those did not upload. Check your connection and try again.');
    }
  };

  return (
    <>
      <SectionRow
        title="Your photos"
        action={add.isPending ? 'Uploading' : 'Add'}
        actionLabel="Add a photo"
        onAction={() => void onAdd()}
      />
      <PhotoGrid
        tiles={[
          ...mine.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              onPress={() => setOpen({ photo, mine: true })}
            />
          )),
          <Pressable
            key="add"
            accessibilityRole="button"
            accessibilityLabel="Add a photo from your library"
            disabled={add.isPending}
            onPress={() => void onAdd()}
            style={[s.photoAdd, { borderColor: base.line, opacity: add.isPending ? 0.5 : 1 }]}
          >
            <Camera size={20} color={base.muted} />
          </Pressable>,
        ]}
      />
      {notice ? <Text style={[s.photoNotice, { color: base.ink }]}>{notice}</Text> : null}
      {photos.isError ? (
        <Text style={[s.photoNotice, { color: base.muted }]}>Photos could not be loaded.</Text>
      ) : null}

      {/* Omitted when nobody has posted, rather than an empty strip under a bare header. */}
      {fans.length > 0 ? (
        <>
          <SectionRow title="From fans at this game" action={fanCountLabel(fans.length)} />
          <PhotoGrid
            tiles={fans.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                onPress={() => setOpen({ photo, mine: false })}
              />
            ))}
          />
        </>
      ) : null}

      <PhotoViewer
        photo={open?.photo ?? null}
        mine={open?.mine ?? false}
        gameId={game.gameId}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

/**
 * Rows of four, as the reference draws them. Tiles are `flex: 1`, which cannot wrap by itself,
 * so the rows are cut here and the last one is padded with spacers to keep its columns.
 */
function PhotoGrid({ tiles }: { tiles: React.ReactElement[] }) {
  const rows: React.ReactElement[][] = [];
  for (let i = 0; i < tiles.length; i += PHOTO_COLUMNS)
    rows.push(tiles.slice(i, i + PHOTO_COLUMNS));
  return (
    <View style={{ gap: 6 }}>
      {rows.map((row, i) => (
        <View key={i} style={s.photos}>
          {row}
          <RowSpacers count={PHOTO_COLUMNS - row.length} />
        </View>
      ))}
    </View>
  );
}

function PhotoTile({ photo, onPress }: { photo: GamePhoto; onPress: () => void }) {
  const { base } = useReferenceTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={photo.kind === 'video' ? 'Open video' : 'Open photo'}
      style={[s.photo, s.photoTile, { backgroundColor: base.surface }]}
    >
      {photo.kind === 'photo' && photo.url ? (
        <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d="M8 5.5v13l10.5-6.5z" fill={base.muted} />
        </Svg>
      )}
    </Pressable>
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
 * The fixture's card, for demo mode and the parity harness, where there is no game row. A real
 * game's card comes from `shareGameFor` instead (useReliveGame), with its own sport and the
 * side the user actually rooted for.
 */
function reliveShareGame(relive: ReliveFixture, steps: readonly ReliveStep[]): ShareGame {
  const last = steps[steps.length - 1];
  const [away, home] = scorePair(last?.score);
  const final = away !== null && home !== null;
  const { date, venue } = parseReliveNote(relive.note);
  return {
    kind: 'game',
    // The reference's demo game is MLB.
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
  // Holds a column open without drawing anything. See RowSpacers.
  photoSpacer: { flex: 1, aspectRatio: 1 },
  photo: { flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  photoTile: { alignItems: 'center', justifyContent: 'center' },
  photoNotice: { fontSize: 12.5, lineHeight: 12.5 * 1.4, marginTop: 8, fontFamily: fontFamily() },
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
