/**
 * Share card bodies. Pure presentation over a ShareTemplate; every template uses theme tokens so
 * the same component renders the light and dark variants. No icons fonts, so the card looks the
 * same in a snapshot as on screen.
 */
import { formatRecord, formatVsExpected, formatWinRate } from '@appname/core';
import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { formatShortDate, totalsLine } from '@/features/passport/format';
import { Stamp } from '@/features/passport/ui/Stamp';
import { gamesLabel, recordText, recordTone } from '@/features/social/copy';
import { wrappedCardCopy, wrappedTitle } from '@/features/wrapped/copy';
import { formatGameDateLong, sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import type {
  ShareCompanion,
  ShareGame,
  ShareGoal,
  SharePledge,
  ShareRecord,
  ShareStamp,
  ShareTemplate,
  ShareWrapped,
} from './types';

function Label({ children }: { children: string }) {
  return (
    <Text
      variant="label"
      color="muted"
      style={{ textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}
    >
      {children}
    </Text>
  );
}

function Headline({
  children,
  color = 'ink',
  size = 64,
}: {
  children: string;
  color?: 'ink' | 'red' | 'blue' | 'green' | 'gold';
  size?: number;
}) {
  return (
    <Text
      variant="display"
      color={color}
      numberOfLines={2}
      adjustsFontSizeToFit
      style={{ fontSize: size, lineHeight: size * 1.05, fontVariant: ['tabular-nums'] }}
    >
      {children}
    </Text>
  );
}

function Badge({ children, tone = 'green' }: { children: string; tone?: 'green' | 'gold' }) {
  const theme = useTheme();
  const c = theme.colors;
  const color = tone === 'green' ? c.green : c.gold;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        borderWidth: 1.5,
        borderColor: color,
        borderRadius: theme.radius.pill,
        paddingVertical: 4,
        paddingHorizontal: 10,
        marginTop: 12,
      }}
    >
      <Text variant="label" style={{ color, fontWeight: '800' }}>
        ✓
      </Text>
      <Text variant="label" style={{ color, fontWeight: '700' }}>
        {children}
      </Text>
    </View>
  );
}

function Tile({ title, value, gold }: { title: string; value: string; gold?: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      style={{
        backgroundColor: c.tint,
        borderRadius: theme.radius.md,
        paddingVertical: 8,
        paddingHorizontal: 10,
        flexBasis: '48%',
        flexGrow: 1,
      }}
    >
      <Text
        variant="h2"
        style={{ color: gold ? c.gold : c.ink, fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text variant="caption" color="muted" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

export function RecordTemplate({ t }: { t: ShareRecord }) {
  const theme = useTheme();
  const pledged = t.pledge.record.wins + t.pledge.record.losses + t.pledge.record.ties > 0;
  return (
    <View>
      <Label>All-time record at games</Label>
      <Headline size={84}>{formatRecord(t.overall)}</Headline>
      <Text variant="sub" color="muted" style={{ marginTop: 4 }}>
        {formatWinRate(t.overall)} win rate · {totalsLine(t.totals)}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.lg,
        }}
      >
        {t.teams.slice(0, 5).map((team) => (
          <Tile key={team.name} title={team.name} value={formatRecord(team.record)} />
        ))}
        <Tile
          gold
          value={formatRecord(t.pledge.record)}
          title={
            pledged
              ? `Pledged, ${formatVsExpected(t.pledge.vs_expected)} vs expected`
              : 'Pledged, none yet'
          }
        />
      </View>
    </View>
  );
}

export function GameTemplate({ t }: { t: ShareGame }) {
  const theme = useTheme();
  const c = theme.colors;
  const final = t.status === 'final' && t.homeScore != null && t.awayScore != null;
  const awayWon = final && (t.awayScore as number) > (t.homeScore as number);
  const homeWon = final && (t.homeScore as number) > (t.awayScore as number);
  const resultWord =
    t.result === 'win' ? 'Win' : t.result === 'loss' ? 'Loss' : t.result === 'tie' ? 'Tie' : null;
  return (
    <View>
      <Label>{`${sportLabel(t.sport)} · ${formatGameDateLong(t.date)}`}</Label>
      {[
        { name: t.away, score: t.awayScore, won: awayWon, tag: 'Away' },
        { name: t.home, score: t.homeScore, won: homeWon, tag: 'Home' },
      ].map((row, i) => (
        <View
          key={row.tag}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
            paddingVertical: 10,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: c.line,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="h2" color={row.won || !final ? 'ink' : 'muted'} numberOfLines={2}>
              {row.name}
            </Text>
            <Text variant="caption" color="muted">
              {row.tag}
            </Text>
          </View>
          <Text
            variant="display"
            color={row.won || !final ? 'ink' : 'muted'}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {final ? String(row.score) : '–'}
          </Text>
        </View>
      ))}
      {t.venue ? (
        <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.sm }}>
          {t.venue}
        </Text>
      ) : null}
      <Text variant="bodyStrong" style={{ marginTop: theme.spacing.md }}>
        {t.side
          ? `Rooting for the ${t.side}${resultWord ? `, ${resultWord.toLowerCase()}` : ''}`
          : 'Neutral, just there for the game'}
      </Text>
      {t.verified ? <Badge>Verified there</Badge> : null}
    </View>
  );
}

export function PledgeTemplate({ t }: { t: SharePledge }) {
  const theme = useTheme();
  const headline =
    t.result === 'win'
      ? 'Won'
      : t.result === 'loss'
        ? 'Lost'
        : t.result === 'tie'
          ? 'Tied'
          : t.result === 'void'
            ? 'Did not count'
            : 'Locked in';
  const color = t.result === 'win' ? 'green' : t.result === 'loss' ? 'red' : 'ink';
  const pct = `${Math.round(t.winProb * 100)}%`;
  return (
    <View>
      <Label>{`Pledge · ${formatGameDateLong(t.date)}`}</Label>
      <Headline color={color} size={72}>
        {headline}
      </Headline>
      <Text variant="h2" style={{ marginTop: theme.spacing.md }}>
        Pledged to the {t.team}
      </Text>
      <Text variant="sub" color="muted" style={{ marginTop: 4 }}>
        {t.away} at {t.home}
      </Text>
      <Text variant="body" style={{ marginTop: theme.spacing.lg }}>
        {t.result === 'win'
          ? `${pct} to win when I picked. +${(1 - t.winProb).toFixed(2)} vs expected.`
          : t.result === 'void'
            ? 'Pledged after the first score, so it did not count.'
            : `${pct} to win when I picked.`}
      </Text>
      {t.result === 'win' && t.winProb < 0.5 ? <Badge tone="gold">Underdog call</Badge> : null}
    </View>
  );
}

export function StampTemplate({ t }: { t: ShareStamp }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Label>{t.stampCount ? `Stamp #${t.stampCount}` : 'New stamp'}</Label>
      <Stamp
        name={t.venue}
        caption={t.visits === 1 ? 'First visit' : `${t.visits} visits`}
        index={t.stampCount ?? 0}
        style={{ width: 220, padding: theme.spacing.lg }}
      />
      <Text variant="h2" align="center" style={{ marginTop: theme.spacing.lg }}>
        {t.venue}
      </Text>
      {t.place ? (
        <Text variant="sub" color="muted" align="center">
          {t.place}
        </Text>
      ) : null}
      {t.firstVisit ? (
        <Text variant="caption" color="muted" align="center" style={{ marginTop: 4 }}>
          First visit {formatShortDate(t.firstVisit)}
        </Text>
      ) : null}
    </View>
  );
}

export function CompanionTemplate({ t }: { t: ShareCompanion }) {
  const theme = useTheme();
  const tone = recordTone(t.wins, t.losses);
  const color = tone === 'good' ? 'green' : tone === 'bad' ? 'red' : 'ink';
  return (
    <View>
      <Label>Our record at games</Label>
      <Headline color={color} size={84}>
        {recordText(t.wins, t.losses, t.ties)}
      </Headline>
      <Text variant="h2" style={{ marginTop: theme.spacing.md }}>
        with {t.name}
      </Text>
      <Text variant="sub" color="muted" style={{ marginTop: 4 }}>
        {gamesLabel(t.games)} together
      </Text>
      <Text variant="body" style={{ marginTop: theme.spacing.lg }}>
        {tone === 'good'
          ? 'Certified lucky charm.'
          : tone === 'bad'
            ? 'Possible jinx. More data needed.'
            : 'Dead even. Someone has to break the tie.'}
      </Text>
    </View>
  );
}

export function GoalTemplate({ t }: { t: ShareGoal }) {
  const theme = useTheme();
  return (
    <View>
      <Label>{`${t.year} goal completed`}</Label>
      <Headline size={44}>{t.title}</Headline>
      <Text variant="h2" color="green" style={{ marginTop: theme.spacing.md }}>
        {t.label}
      </Text>
      <Badge>Done</Badge>
    </View>
  );
}

export function WrappedTemplate({ t }: { t: ShareWrapped }) {
  const theme = useTheme();
  const copy = wrappedCardCopy(t.card, t.sport, t.season);
  return (
    <View>
      <Label>{wrappedTitle(t.sport, t.season)}</Label>
      <Text variant="sub" color={copy.accent} style={{ fontWeight: '700', marginBottom: 4 }}>
        {copy.label}
      </Text>
      <Headline color={copy.accent} size={copy.headline.length > 12 ? 40 : 72}>
        {copy.headline}
      </Headline>
      <Text variant="body" style={{ marginTop: theme.spacing.md }}>
        {copy.body}
      </Text>
      {copy.lines.slice(0, 5).map((line) => (
        <Text key={line} variant="sub" color="muted" style={{ marginTop: 4 }} numberOfLines={1}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function TemplateBody({ template }: { template: ShareTemplate }) {
  switch (template.kind) {
    case 'record':
      return <RecordTemplate t={template} />;
    case 'game':
      return <GameTemplate t={template} />;
    case 'pledge':
      return <PledgeTemplate t={template} />;
    case 'stamp':
      return <StampTemplate t={template} />;
    case 'companion':
      return <CompanionTemplate t={template} />;
    case 'goal':
      return <GoalTemplate t={template} />;
    case 'wrapped':
      return <WrappedTemplate t={template} />;
  }
}

/** Title for the share sheet and the file name. */
export function templateTitle(template: ShareTemplate): string {
  switch (template.kind) {
    case 'record':
      return 'My record';
    case 'game':
      return `${template.away} at ${template.home}`;
    case 'pledge':
      return 'My pledge';
    case 'stamp':
      return template.venue;
    case 'companion':
      return `With ${template.name}`;
    case 'goal':
      return template.title;
    case 'wrapped':
      return wrappedTitle(template.sport, template.season);
  }
}
