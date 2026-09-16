import {
  FRIENDS,
  GAMES,
  GAME_DAY,
  GAME_LOGS,
  GUIDE,
  GUIDE_ROWS,
  PASSPORT,
  PASSPORT_PILLS,
  PICK_A_SIDE,
  PROFILE,
  RELIVE,
  RELIVE_FAN_PHOTOS,
  RELIVE_STEPS,
  RELIVE_WP,
  RELIVE_YOUR_PHOTOS,
  stampsFor,
} from '@/features/demo/fixtures';

import type { Repository } from './types';

/**
 * The demo implementation (SPEC.md 8.9): the reference's own sample data, verbatim.
 *
 * It exists so the visual parity harness has something to compare, and so the Plan and
 * Stadium guide shells have content in v1 while their features are unbuilt.
 */
export const demoRepository: Repository = {
  passportPills: () => PASSPORT_PILLS,
  passport: (pill) => {
    const data = PASSPORT[pill] ?? PASSPORT.all;
    if (!data) throw new Error(`no passport fixture for "${pill}"`);
    return data;
  },
  stamps: (pill) => stampsFor(pill),
  gameLog: (key) => GAME_LOGS[key] ?? null,
  games: () => GAMES,
  pickASide: () => PICK_A_SIDE,
  relive: () => RELIVE,
  reliveSteps: () => RELIVE_STEPS,
  reliveWinProb: () => RELIVE_WP,
  relivePhotos: () => RELIVE_YOUR_PHOTOS,
  reliveFanPhotos: () => RELIVE_FAN_PHOTOS,
  gameDay: () => GAME_DAY,
  guide: () => GUIDE,
  guideRows: (tab) => GUIDE_ROWS[tab] ?? GUIDE_ROWS.food ?? [],
  profile: () => PROFILE,
  friends: () => FRIENDS,
};
