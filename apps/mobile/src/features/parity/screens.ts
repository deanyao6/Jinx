/**
 * Maps a parity deep link to the screen id the harness expects, and to the screen the
 * app should render.
 *
 * The ids must match scripts/parity/screens.mjs exactly. They are listed here rather
 * than imported because that file is an ESM Node script outside the app's build.
 */

export type ParityScreenId =
  | 'passport-all'
  | 'passport-phi'
  | 'passport-phl'
  | 'passport-log-phillies'
  | 'passport-log-neutral'
  | 'pick-a-side'
  | 'pick-a-side-picked'
  | 'games'
  | 'relive-start'
  | 'relive-mid'
  | 'game-day'
  | 'guide-food'
  | 'guide-bathrooms'
  | 'guide-seats'
  | 'profile'
  | 'friends'
  | 'parity-selftest';

type Params = Record<string, string | undefined>;

/**
 * Resolve `/parity/<path>?<params>` to a screen id, or null when the combination is not
 * one the harness asks for. Returning null leaves the marker unpainted, which the
 * harness reports as "not built" rather than diffing whatever happened to render.
 */
export function resolveParityScreen(path: string, params: Params): ParityScreenId | null {
  switch (path) {
    case 'passport': {
      if (params.log === 'phi') return 'passport-log-phillies';
      if (params.log === 'neutral') return 'passport-log-neutral';
      if (params.team === 'phi') return 'passport-phi';
      if (params.team === 'phl') return 'passport-phl';
      return 'passport-all';
    }
    case 'pick-a-side':
      return params.picked === 'phi' ? 'pick-a-side-picked' : 'pick-a-side';
    case 'games':
      return 'games';
    case 'relive':
      return params.step === '5' ? 'relive-mid' : 'relive-start';
    case 'plan':
      return 'game-day';
    case 'guide': {
      if (params.tab === 'bath') return 'guide-bathrooms';
      if (params.tab === 'seats') return 'guide-seats';
      return 'guide-food';
    }
    case 'profile':
      return params.panel === 'friends' ? 'friends' : 'profile';
    // Proves the harness end to end without depending on a ported screen.
    case 'selftest':
      return 'parity-selftest';
    default:
      return null;
  }
}
