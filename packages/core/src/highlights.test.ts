import { describe, expect, it } from 'vitest';

import {
  MLB_VIDEO_HUB,
  NFL_VIDEO_HUB,
  highlightsSiteLabel,
  nflNicknameInSeason,
  nflWeekSlug,
  officialHighlightsUrl,
} from './highlights.js';

const nfl = {
  sport: 'nfl',
  providerGameId: '2025_13_CHI_PHI',
  season: 2025,
  gameType: 'regular',
  awayNickname: 'Bears',
  homeNickname: 'Eagles',
};

describe('officialHighlightsUrl', () => {
  // The three URLs asserted here were requested on 2026-09-17 and answered 200.
  it('opens the MLB game by gamePk', () => {
    expect(
      officialHighlightsUrl({
        sport: 'mlb',
        providerGameId: '823191',
        season: 2026,
        gameType: 'regular',
        awayNickname: 'Tigers',
        homeNickname: 'Giants',
      }),
    ).toBe('https://www.mlb.com/gameday/823191/final/video');
  });

  it('opens the NFL game by matchup, season and week', () => {
    expect(officialHighlightsUrl(nfl)).toBe(
      'https://www.nfl.com/games/bears-at-eagles-2025-reg-13',
    );
  });

  it('counts a playoff week from the start of the playoffs', () => {
    // Super Bowl LIX: nflverse week 22 of the 2024 season.
    expect(
      officialHighlightsUrl({
        ...nfl,
        providerGameId: '2024_22_KC_PHI',
        season: 2024,
        gameType: 'postseason',
        awayNickname: 'Chiefs',
      }),
    ).toBe('https://www.nfl.com/games/chiefs-at-eagles-2024-post-4');
  });

  it('never sends an NFL game to MLB, which is what the screen used to do', () => {
    expect(officialHighlightsUrl(nfl)).not.toContain('mlb.com');
    expect(highlightsSiteLabel('nfl')).toBe('Opens on NFL.com');
    expect(highlightsSiteLabel('mlb')).toBe('Opens on MLB.com');
  });

  it('sends an MLS match to the league hub, never MLB.com', () => {
    expect(officialHighlightsUrl({ ...nfl, sport: 'mls', providerGameId: '761829' })).toBe(
      'https://www.mlssoccer.com/video/',
    );
    expect(highlightsSiteLabel('mls')).toBe('Opens on MLSsoccer.com');
  });

  it('falls back to the league hub rather than guess a URL that would 404', () => {
    expect(officialHighlightsUrl({ ...nfl, homeNickname: null })).toBe(NFL_VIDEO_HUB);
    expect(officialHighlightsUrl({ ...nfl, providerGameId: 'garbage' })).toBe(NFL_VIDEO_HUB);
    expect(officialHighlightsUrl({ ...nfl, gameType: 'preseason' })).toBe(NFL_VIDEO_HUB);
    expect(officialHighlightsUrl({ ...nfl, sport: 'mlb', providerGameId: '2025_13_CHI_PHI' })).toBe(
      MLB_VIDEO_HUB,
    );
  });

  it('slugs a nickname with digits or spaces', () => {
    expect(officialHighlightsUrl({ ...nfl, awayNickname: '49ers' })).toContain('/49ers-at-eagles-');
    expect(officialHighlightsUrl({ ...nfl, awayNickname: 'Football Team' })).toContain(
      '/football-team-at-eagles-',
    );
  });
});

describe('a franchise that was renamed', () => {
  // nfl.com files a game under the name of the time; all three were requested on 2026-09-17.
  const was = (season: number, week: number) =>
    officialHighlightsUrl({
      ...nfl,
      providerGameId: `${season}_${String(week).padStart(2, '0')}_WAS_PHI`,
      season,
      awayNickname: 'Commanders',
    });

  it('uses the name Washington had that season', () => {
    expect(was(2019, 1)).toBe('https://www.nfl.com/games/redskins-at-eagles-2019-reg-1');
    expect(was(2020, 17)).toBe('https://www.nfl.com/games/football-team-at-eagles-2020-reg-17');
    expect(was(2022, 10)).toBe('https://www.nfl.com/games/commanders-at-eagles-2022-reg-10');
  });

  it('leaves every other team alone', () => {
    expect(nflNicknameInSeason('Raiders', 2015)).toBe('Raiders');
    expect(nflNicknameInSeason('Eagles', 2004)).toBe('Eagles');
  });
});

describe('nflWeekSlug', () => {
  it('knows the season grew to 18 weeks in 2021', () => {
    expect(nflWeekSlug(2020, 18, 'postseason')).toBe('post-1');
    expect(nflWeekSlug(2020, 21, 'postseason')).toBe('post-4');
    expect(nflWeekSlug(2021, 19, 'postseason')).toBe('post-1');
    expect(nflWeekSlug(2021, 22, 'postseason')).toBe('post-4');
  });

  it('refuses a week that cannot be a playoff round', () => {
    expect(nflWeekSlug(2021, 18, 'postseason')).toBeNull();
    expect(nflWeekSlug(2021, 23, 'postseason')).toBeNull();
    expect(nflWeekSlug(2021, Number.NaN, 'regular')).toBeNull();
  });
});
