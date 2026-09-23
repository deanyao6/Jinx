/** Plain-copy builders for Wrapped cards, shared by the swipeable screen and the share card. Pure. */
import { formatRecord, formatVsExpected } from '@jinx/core';

import { momentLabel } from '@/features/attendances/moments';
import { eggs } from '@/features/eggs/flags';
import { CHARM_LABEL, isCharmCandidate, isJinxCandidate, JINX_LABEL } from '@/features/eggs/jinx';
import { formatDuration, formatMiles } from '@/features/passport/format';
import { sportLabel } from '@/lib/format';
import type { WrappedCard } from './types';

export type WrappedCardCopy = {
  /** Small caps label above the headline ("Games attended"). */
  label: string;
  /** The big number or phrase. */
  headline: string;
  /** One sentence under the headline. */
  body: string;
  /** Optional supporting lines (team records, new stamps, goal titles). */
  lines: string[];
  /** Accent token for the card, cycling through the palette. */
  accent: 'red' | 'blue' | 'green' | 'gold';
};

export function wrappedTitle(sport: string, season: number): string {
  return `${season} ${sportLabel(sport)} Wrapped`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function wrappedCardCopy(card: WrappedCard, sport: string, season: number): WrappedCardCopy {
  const seasonName = `${season} ${sportLabel(sport)}`;
  // MLS plays matches; the other three play games.
  const [one, many] = sport === 'mls' ? ['match', 'matches'] : ['game', 'games'];
  switch (card.kind) {
    case 'games':
      return {
        label: sport === 'mls' ? 'Matches attended' : 'Games attended',
        headline: String(card.games),
        body: `${card.games === 1 ? one : many} in the ${seasonName} season.`,
        lines: [],
        accent: 'red',
      };
    case 'record': {
      const r = card.record;
      const decided = r.wins + r.losses + r.ties;
      return {
        label: 'Your record',
        headline: decided ? formatRecord(r) : 'Neutral',
        body: decided
          ? `at games where you had a side this season.`
          : 'You had no side at any game this season. Pledge or follow a team to build a record.',
        lines: card.teams.map((t) => `${t.name} ${formatRecord(t.record)}`),
        accent: 'blue',
      };
    }
    case 'pledge':
      if (!card.pledge) {
        return {
          label: 'Pledges',
          headline: 'No pledges',
          body: 'Check in at a neutral game and pick a side before the lock to start a pledge record.',
          lines: [],
          accent: 'gold',
        };
      }
      return {
        label: 'Pledge record',
        headline: formatRecord(card.pledge.record),
        body: `${formatVsExpected(card.pledge.vs_expected)} vs expected. Backing underdogs pays.`,
        lines: [],
        accent: 'gold',
      };
    case 'stamps': {
      const fresh = card.stamps.new;
      return {
        label: 'Venues',
        headline: String(card.stamps.venues),
        body: `${card.stamps.venues === 1 ? 'venue' : 'venues'} this season, ${plural(fresh.length, 'new stamp')}.`,
        lines: fresh.map((v) => v.name),
        accent: 'green',
      };
    }
    case 'player':
      if (!card.player) {
        return {
          label: 'Most-seen player',
          headline: 'Lineups pending',
          body: 'Players seen fill in once the lineups for your games are loaded.',
          lines: [],
          accent: 'red',
        };
      }
      return {
        label: 'Most-seen player',
        headline: card.player.name,
        body: `You saw them play ${plural(card.player.count, 'time')} this season.`,
        lines: [],
        accent: 'red',
      };
    case 'moment':
      if (!card.moment) {
        return {
          label: 'Top moment',
          headline: 'Nothing wild yet',
          body: 'Walk-offs, grand slams and overtime thrillers land here when you witness one.',
          lines: [],
          accent: 'blue',
        };
      }
      return {
        label: 'Top moment',
        headline: momentLabel(card.moment.type),
        body: card.moment.player
          ? `${card.moment.player}, and you were there.`
          : 'And you were there.',
        lines: [],
        accent: 'blue',
      };
    case 'companions': {
      const lines: string[] = [];
      // The certified jinx egg (`features/eggs/jinx`). The server already sends the season's
      // one best and one worst companion, so asking whether each clears the bar is the whole
      // rule. One that does not keeps the wording this card always had.
      const tally = (c: NonNullable<typeof card.best>) => ({
        id: c.person_id,
        name: c.name,
        wins: c.record.wins,
        losses: c.record.losses,
      });
      if (card.best) {
        const label =
          eggs.certifiedJinx && isCharmCandidate(tally(card.best)) ? CHARM_LABEL : 'Lucky charm';
        lines.push(`${label}: ${card.best.name}, ${formatRecord(card.best.record)}`);
      }
      if (card.worst && card.worst.person_id !== card.best?.person_id) {
        const label =
          eggs.certifiedJinx && isJinxCandidate(tally(card.worst)) ? JINX_LABEL : 'Jinx';
        lines.push(`${label}: ${card.worst.name}, ${formatRecord(card.worst.record)}`);
      }
      if (!card.best) {
        return {
          label: 'Companions',
          headline: 'Solo season',
          body: 'Tag the people you go with to find out who is lucky and who is a jinx.',
          lines: [],
          accent: 'green',
        };
      }
      return {
        label: 'Companions',
        headline: card.best.name,
        body: `Your best record together, ${formatRecord(card.best.record)}.`,
        lines,
        accent: 'green',
      };
    }
    case 'miles':
      if (card.km == null) {
        return {
          label: 'Miles traveled',
          headline: '–',
          body: 'Add a home city in the You tab to count the miles to every venue.',
          lines: [],
          accent: 'gold',
        };
      }
      return {
        label: 'Miles traveled',
        headline: formatMiles(card.km),
        body: 'from home to the games you attended, one way.',
        lines: [],
        accent: 'gold',
      };
    case 'superlative': {
      const s = card.superlatives;
      const lines: string[] = [];
      if (s.coldest) lines.push(`Coldest game, ${Math.round(s.coldest.value)}°F`);
      if (s.hottest) lines.push(`Hottest game, ${Math.round(s.hottest.value)}°F`);
      if (s.longest)
        lines.push(`Longest game, ${formatDuration(s.longest.minutes, s.longest.periods)}`);
      if (s.highest_scoring) lines.push(`Highest scoring, ${s.highest_scoring.total} total`);
      const first = lines[0];
      if (!first) {
        return {
          label: 'Superlatives',
          headline: 'Not yet',
          body: 'Weather, game length and scoring extremes fill in as game details load.',
          lines: [],
          accent: 'red',
        };
      }
      const [title, value] = first.split(', ');
      return {
        label: title ?? 'Superlative',
        headline: value ?? first,
        body: 'The extremes of your season.',
        lines: lines.slice(1),
        accent: 'red',
      };
    }
    case 'goals':
      return {
        label: 'Goals completed',
        headline: String(card.goals.length),
        body: card.goals.length
          ? `${card.goals.length === 1 ? 'goal' : 'goals'} checked off this year.`
          : 'No goals completed this year. Set one for next season.',
        lines: card.goals.map((g) => g.title),
        accent: 'green',
      };
  }
}
