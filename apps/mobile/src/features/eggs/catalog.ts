import type React from 'react';

import type { EggKey } from './flags';
import { ConfettiPreview, CursePreview, RallyCapPreview, RewindPreview } from './previews';

/**
 * Every easter egg, for the dev page at Settings, About, Easter eggs (`app/you/eggs.tsx`).
 *
 * Adding an egg to that page is one entry here. `key` is its switch in `./flags`; `how` says
 * what sets it off for real; `Preview`, when there is something to play, is a component that
 * draws the egg on sample data with its own Play button. An egg with nothing to play (it is a
 * look, not a moment) leaves `Preview` out and the page just lists it.
 */
export type EggEntry = {
  key: EggKey;
  title: string;
  how: string;
  Preview?: React.ComponentType;
};

export const EGG_CATALOG: readonly EggEntry[] = [
  {
    key: 'wornStamps',
    title: 'Worn stamps',
    how: 'A stadium visited 5 times wears its stamp down, and 10 times wears it right through.',
  },
  {
    key: 'goldenStamps',
    title: 'Golden stamps',
    how: 'A stadium where you saw something rare is struck in gold.',
  },
  {
    key: 'recordRewind',
    title: 'Record rewind',
    how: 'Press and hold the big record on the Passport. Lift your finger to stop.',
    Preview: RewindPreview,
  },
  {
    key: 'curseBreaker',
    title: 'Curse breaker',
    how: 'A win that ends 5 or more straight losses shatters a mirror over the record, once.',
    Preview: CursePreview,
  },
  {
    key: 'rallyCap',
    title: 'Rally cap',
    how: 'Checked in, your side behind, late in the game: shake the phone or hold the wordmark.',
    Preview: RallyCapPreview,
  },
  {
    key: 'stretchConfetti',
    title: 'Stretch-time confetti',
    how: "Open the app during the sport's signature break while checked in. Once per game.",
    Preview: ConfettiPreview,
  },
  {
    key: 'certifiedJinx',
    title: 'Certified jinx',
    how: 'Your worst companion over 4 or more decided games, at .250 or worse, gets a black cat. The best, at .750 or better, is your good luck charm.',
  },
  {
    key: 'secretHandshake',
    title: 'Secret handshake',
    how: "Two friends who follow each other, both checked in to one game, each tap the other's avatar under Also there. Both get a We were there card.",
  },
];
