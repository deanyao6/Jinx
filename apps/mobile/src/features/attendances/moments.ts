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
  buzzer_beater: 'Buzzer-beater',
  fifty_points: '50-point game',
  triple_double: 'Triple-double',
  quadruple_double: 'Quadruple-double',
  twenty_rebounds: '20-rebound game',
  twenty_assists: '20-assist game',
  comeback_20: 'Comeback from 20 down',
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
  if ((type === 'comeback_14' || type === 'comeback_20') && typeof deficit === 'number')
    return `Down ${deficit}`;
  const points = detail['points'];
  const rebounds = detail['rebounds'];
  const assists = detail['assists'];
  if (type === 'fifty_points' && typeof points === 'number') return `${points} points`;
  if (
    (type === 'triple_double' || type === 'quadruple_double') &&
    typeof points === 'number' &&
    typeof rebounds === 'number' &&
    typeof assists === 'number'
  )
    return `${points} pts, ${rebounds} reb, ${assists} ast`;
  if (type === 'twenty_rebounds' && typeof rebounds === 'number') return `${rebounds} rebounds`;
  if (type === 'twenty_assists' && typeof assists === 'number') return `${assists} assists`;
  if (type === 'buzzer_beater' && detail['winning'] === true) return 'Game-winner';
  if (type === 'buzzer_beater' && detail['tying'] === true) return 'Tied it';
  return null;
}
