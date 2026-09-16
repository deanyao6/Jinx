/** Friendly labels for game_events.type (SPEC.md 6.7). */
const LABELS: Record<string, string> = {
  walk_off: 'Walk-off',
  walk_off_home_run: 'Walk-off home run',
  grand_slam: 'Grand slam',
  cycle: 'Hit for the cycle',
  no_hitter: 'No-hitter',
  perfect_game: 'Perfect game',
  extra_innings: 'Extra innings',
  shutout: 'Shutout',
  immaculate_inning: 'Immaculate inning',
  home_run: 'Home run',
  overtime: 'Overtime',
  late_go_ahead_score: 'Late go-ahead score',
  walk_off_score: 'Walk-off score',
  pick_six: 'Pick six',
  fumble_return_td: 'Fumble return touchdown',
  kick_return_td: 'Kick return touchdown',
  safety: 'Safety',
  long_field_goal: 'Long field goal',
  comeback_14: 'Comeback from 14 down',
};

export function momentLabel(type: string): string {
  const known = LABELS[type];
  if (known) return known;
  return type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Short extra context from the detail payload, when there is something worth showing. */
export function momentDetail(type: string, detail: Record<string, unknown>): string | null {
  const yards = detail['yards'];
  if (type === 'long_field_goal' && typeof yards === 'number') return `${yards} yards`;
  if (
    (type === 'pick_six' || type === 'kick_return_td' || type === 'fumble_return_td') &&
    typeof yards === 'number'
  ) {
    return `${yards} yards`;
  }
  const innings = detail['innings'];
  if (type === 'extra_innings' && typeof innings === 'number') return `${innings} innings`;
  const deficit = detail['deficit'];
  if (type === 'comeback_14' && typeof deficit === 'number') return `Down ${deficit}`;
  return null;
}
