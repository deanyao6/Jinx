import type { IconName } from '@/components/reference/icons';

export type TemplateMeta = { icon: IconName; description: string };

/**
 * The icon and the one line of help each goal template shows in the picker. Keyed by the
 * template keys in `@jinx/core`; the titles and the rules stay there. A template added to core
 * without a row here still appears, with the fallback below.
 */
const META: Record<string, TemplateMeta> = {
  attend_n: { icon: 'i-ticket', description: 'Every game you go to this year counts.' },
  new_stadiums: { icon: 'i-map', description: 'Venues you have never been to before.' },
  team_on_road: { icon: 'i-route', description: 'Catch your team somewhere other than home.' },
  win_pledges: { icon: 'i-flag', description: 'Pick the side that wins at neutral games.' },
  beat_expected: { icon: 'i-trend', description: 'Win more pledges than the odds say you should.' },
  walk_off: { icon: 'i-bolt', description: 'Be there when the home team wins it at the last.' },
  people: { icon: 'i-users', description: 'Bring someone different along each time.' },
  hr_ballparks: { icon: 'i-target', description: 'See a home run hit in different MLB ballparks.' },
  arenas: { icon: 'i-map', description: 'Different NBA arenas in one year.' },
  buzzer_beater: {
    icon: 'i-bolt',
    description: 'Be there when a shot at the horn wins it or ties it.',
  },
};

const FALLBACK: TemplateMeta = { icon: 'i-spark', description: '' };

export function templateMeta(key: string): TemplateMeta {
  return META[key] ?? FALLBACK;
}
