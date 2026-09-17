import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS } from '@/components/reference/icons';
import { useRepository } from '@/features/data/context';
import { RepositoryAvatar } from '@/features/data/RepositoryAvatar';
import type { FriendsFixture, PersonRef } from '@/features/data/shapes';
import { eggs } from '@/features/eggs/flags';
import { CHARM_LABEL, JINX_LABEL } from '@/features/eggs/jinx';
import { JinxBadge } from '@/features/eggs/JinxBadge';
import { useEggsLive } from '@/features/eggs/runtime';
import { TabBar } from '@/features/passport/reference/parts';
import { fontFamily } from '@/theme/fonts';
import { ReferenceThemeProvider, TeamTheme, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { border, screenPadding } from '@/theme/reference/tokens';

/**
 * The Friends slide-over, ported from `.panel#friends` (SPEC.md 8.8.8).
 *
 * Opens from Profile's Friends row. The companion records, the rivalry card and the
 * "before you connected" card, with every person ringed in their own team's colour.
 */
export function FriendsPanel({ onClose }: { onClose?: () => void }) {
  const profile = useRepository().profile();
  return (
    <ReferenceThemeProvider team={profile.team}>
      <Body onClose={onClose ?? (() => {})} />
    </ReferenceThemeProvider>
  );
}

type Person = FriendsFixture['people'][number];

/**
 * The person a card is about, found by the name the card itself prints.
 *
 * The rivalry and overlap cards carry prose and scores, not ids: the rivalry names its
 * rival in `them.label` ("Jordan") and the overlap names a companion inside its sentence.
 * Matching that text against the first word of each person's name is the only link the
 * fixture supports, so it is what the cards navigate by. When the repository carries a
 * person id on each card this becomes a lookup and this function goes away. A card that
 * matches nobody stays inert rather than opening someone else's profile.
 */
function personNamedIn(people: readonly Person[], text: string): Person | null {
  return people.find((p) => text.includes(p.name.split(' ')[0] ?? p.name)) ?? null;
}

/** What each tab says when it has nobody to show, keyed by the fixture's own tab label. */
const EMPTY_TAB: Record<string, string> = {
  With: 'No games with anyone yet.',
  Following: 'You are not following anyone yet.',
  Rivals: 'No rivals yet.',
};

function Body({ onClose }: { onClose: () => void }) {
  // `friends.tabs` is `as const`, so without widening this infers the literal 'With'.
  const repository = useRepository();
  const friends = repository.friends();
  // The certified jinx egg is about your own records, so it is inert on the demo account:
  // the reference's Jordan is 0–4 and `npm run parity` must not grow a cat.
  const eggsLive = useEggsLive();
  const showLuck = eggs.certifiedJinx && eggsLive;
  const [tab, setTab] = React.useState<string>(friends.tabs[0] ?? 'With');
  const { base } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const openPerson = (person: Person) =>
    // `key` is the avatar seed, and the only per-person identifier the fixture carries.
    // Against Supabase it is the profile id, which is what this route already expects.
    router.push(`/friends/person/${person.key}` as Href);
  const Back = ICONS['i-chev-l'];
  const Search = ICONS['i-search'];
  const Swords = ICONS['i-swords'];

  /**
   * The tabs used to set state and change nothing, so all three showed the same people.
   *
   * `friends.people` is a list of companion records — everyone on it has a shared-games
   * count and a record — and nobody on it carries a follow flag. So "With" is the list as
   * given, "Rivals" is whoever the rivalry card names, and "Following" has no data behind
   * it at all and says so. Showing the same four people under three labels was a lie;
   * an honest empty state is not.
   */
  const rival = friends.rivalry ? personNamedIn(friends.people, friends.rivalry.them.label) : null;
  const people = tab === 'With' ? friends.people : tab === 'Rivals' ? (rival ? [rival] : []) : [];
  // Each card belongs to the tab it describes: the head-to-head is about the rival, the
  // overlap is about a companion you went with.
  const showRivalry = friends.rivalry != null && (tab === 'With' || tab === 'Rivals');
  const showOverlap = friends.overlap != null && tab === 'With';

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
              accessibilityLabel="Back to profile"
              onPress={onClose}
              style={[s.iconButton, { backgroundColor: base.surface }]}
            >
              <Back size={20} color={base.ink} />
            </Pressable>
            <Text style={[s.topTitle, { color: base.ink }]}>Friends</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find friends"
            onPress={() => router.push('/friends/find' as Href)}
            style={[s.iconButton, { backgroundColor: base.surface }]}
          >
            <Search size={20} color={base.ink} />
          </Pressable>
        </View>

        <View style={[s.seg, { backgroundColor: base.surface }]}>
          {friends.tabs.map((option) => {
            const on = option === tab;
            return (
              <Pressable
                key={option}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setTab(option)}
                style={[s.segItem, on ? { backgroundColor: base.scr } : null]}
              >
                <Text style={[on ? s.segTextOn : s.segText, { color: on ? base.ink : base.muted }]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[s.note, { color: base.muted }]}>{friends.note}</Text>

        <View>
          {people.map((person, i) => (
            <TeamTheme key={person.key} team={person.team}>
              <FriendRow
                person={person}
                who={repository.person(person.key)}
                luck={showLuck && tab === 'With' ? person.luck : undefined}
                first={i === 0}
                onPress={() => openPerson(person)}
              />
            </TeamTheme>
          ))}
          {people.length === 0 ? (
            <Text style={[s.empty, { color: base.muted }]}>{EMPTY_TAB[tab] ?? 'Nobody yet.'}</Text>
          ) : null}
        </View>

        {/* The rivalry card takes the rival's team colour. A user with no rival, or none
            they have played, gets no card rather than an empty one. */}
        {showRivalry && friends.rivalry ? (
          <TeamTheme team={friends.rivalry.team}>
            <RivalryCard
              rivalry={friends.rivalry}
              onPress={rival ? () => openPerson(rival) : undefined}
            >
              <Swords size={20} color={base.muted} />
            </RivalryCard>
          </TeamTheme>
        ) : null}

        {showOverlap && friends.overlap ? (
          <OverlapCard
            overlap={friends.overlap}
            person={personNamedIn(friends.people, friends.overlap.text)}
            onOpen={openPerson}
          />
        ) : null}
      </ScrollView>
      <TabBar active="Profile" />
    </View>
  );
}

/** `.fr`: a ringed photo, name with the team dot, and the record in its tone colour. */
function FriendRow({
  person,
  who,
  luck,
  first,
  onPress,
}: {
  person: Person;
  /** The real person behind the row, or null for the demo's drawn faces. */
  who: PersonRef | null;
  /** The certified jinx egg: a cat on the avatar, or the quieter spark. Undefined draws neither. */
  luck?: Person['luck'];
  first: boolean;
  onPress: () => void;
}) {
  const { base, team } = useReferenceTheme();
  const tone = person.tone === 'good' ? base.good : person.tone === 'bad' ? base.bad : base.ink;
  const luckLabel = luck === 'jinx' ? JINX_LABEL : luck === 'charm' ? CHARM_LABEL : null;
  const Spark = ICONS['i-spark'];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        luckLabel
          ? `${person.name}, ${luckLabel}, ${person.sub}`
          : [person.name, person.teamName, person.sub].filter(Boolean).join(', ')
      }
      onPress={onPress}
      style={[s.fr, first ? null : { borderTopWidth: border.hairline, borderTopColor: base.line }]}
    >
      <View style={[s.frPfp, { borderColor: team.accent }]}>
        <View style={s.frPfpInner}>
          <RepositoryAvatar who={person.key} person={who} size={38} />
        </View>
        {luck === 'jinx' ? <JinxBadge size={16} ringColor={base.scr} inset={-4} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.frName, { color: base.ink }]}>{person.name}</Text>
        {luckLabel ? (
          <View style={s.frMetaRow}>
            {luck === 'charm' ? <Spark size={13} color={team.accent} /> : null}
            <Text style={[s.frMeta, { color: base.muted }]} numberOfLines={1}>
              <Text style={[s.frLuck, { color: base.ink }]}>{luckLabel}</Text>
              {` · ${person.sub}`}
            </Text>
          </View>
        ) : (
          <View style={s.frMetaRow}>
            <View style={[s.frDot, { backgroundColor: team.accent }]} />
            <Text style={[s.frMeta, { color: base.muted }]} numberOfLines={1}>
              {/* A companion with no team (a placeholder like Dad) has only the count. */}
              {[person.teamName, person.sub].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}
      </View>
      <Text style={[s.frRecord, { color: tone }]}>{person.record}</Text>
    </Pressable>
  );
}

/** `.card` for "Before you connected". Opens the companion it names, when it names one. */
function OverlapCard({
  overlap,
  person,
  onOpen,
}: {
  overlap: NonNullable<FriendsFixture['overlap']>;
  person: Person | null;
  onOpen: (person: Person) => void;
}) {
  const { base } = useReferenceTheme();
  const Wrap = person ? Pressable : View;
  return (
    <Wrap
      {...(person
        ? {
            accessibilityRole: 'button' as const,
            accessibilityLabel: `${overlap.label}: ${person.name}`,
            onPress: () => onOpen(person),
          }
        : null)}
      style={[s.card, { backgroundColor: base.surface }]}
    >
      <Text style={[s.cardLabel, { color: base.muted }]}>{overlap.label}</Text>
      <Text style={[s.overlapText, { color: base.ink }]}>{overlap.text}</Text>
    </Wrap>
  );
}

/** `.card.t-nym` with the head-to-head `.vs` row. */
function RivalryCard({
  rivalry,
  children,
  onPress,
}: {
  rivalry: NonNullable<FriendsFixture['rivalry']>;
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const { base, team } = useReferenceTheme();
  const r = rivalry;
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      {...(onPress
        ? { accessibilityRole: 'button' as const, accessibilityLabel: r.label, onPress }
        : null)}
      style={[s.card, { backgroundColor: base.surface }]}
    >
      <Text style={[s.cardLabel, { color: base.muted }]}>{r.label}</Text>
      <View style={s.vs}>
        <View style={{ alignItems: 'center' }}>
          {/* "You" is scored in your own team colour, the rival in theirs. */}
          <TeamTheme team={r.you.team}>
            <VsScore value={r.you.score} />
          </TeamTheme>
          <Text style={[s.vsLabel, { color: base.muted }]}>{r.you.label}</Text>
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          {children}
          <Text style={[s.vsMiddle, { color: base.muted }]}>{r.middle}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={[s.vsScore, { color: team.accent }]}>{r.them.score}</Text>
          <Text style={[s.vsLabel, { color: base.muted }]}>{r.them.label}</Text>
        </View>
      </View>
    </Wrap>
  );
}

function VsScore({ value }: { value: string }) {
  const { team } = useReferenceTheme();
  return <Text style={[s.vsScore, { color: team.accent }]}>{value}</Text>;
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
  topTitle: { fontSize: 24, fontFamily: fontFamily({ weight: 850 }), letterSpacing: -24 * 0.01 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  seg: { flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 6 },
  segItem: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  segText: { fontSize: 13.5, fontFamily: fontFamily() },
  segTextOn: { fontSize: 13.5, fontFamily: fontFamily({ weight: 750 }) },

  note: {
    fontSize: 13,
    lineHeight: 13 * 1.45,
    marginTop: 6,
    marginBottom: 2,
    fontFamily: fontFamily(),
  },

  // `.fr{gap:12px;padding:10px 0}`
  fr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  // `.fr .pfp{width:46px;height:46px;padding:2px;border:2px solid var(--t)}`
  frPfp: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frPfpInner: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  frName: { fontSize: 14.5, fontFamily: fontFamily({ weight: 700 }) },
  frMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  frDot: { width: 9, height: 9, borderRadius: 4.5 },
  frMeta: { fontSize: 12.5, fontFamily: fontFamily(), flex: 1 },
  frLuck: { fontSize: 12.5, fontFamily: fontFamily({ weight: 700 }) },
  frRecord: { fontSize: 19, fontFamily: fontFamily({ width: 64, weight: 900 }) },

  // `.card{border-radius:18px;padding:13px;margin-top:10px}`
  card: { borderRadius: 18, padding: 13, marginTop: 10 },
  cardLabel: { fontSize: 12.5, marginBottom: 6, fontFamily: fontFamily() },
  vs: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vsScore: {
    // `.vs strong{font-size:42px;line-height:.9}`. Left as a plain Text: <TightText>
    // measured worse here than the explicit line height, unlike everywhere else.
    fontSize: 42,
    lineHeight: 42 * 0.9,
    fontFamily: fontFamily({ width: 62, weight: 900 }),
  },
  vsLabel: { fontSize: 12, fontFamily: fontFamily() },
  vsMiddle: { fontSize: 13, fontFamily: fontFamily() },
  overlapText: { fontSize: 14, lineHeight: 14 * 1.45, fontFamily: fontFamily() },
  // Only ever drawn on a tab with nothing behind it, so it cannot move the default view
  // the parity harness measures.
  empty: { fontSize: 14, lineHeight: 14 * 1.45, paddingVertical: 14, fontFamily: fontFamily() },
});
