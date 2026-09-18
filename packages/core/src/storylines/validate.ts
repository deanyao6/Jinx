/**
 * Checks a model-written storyline against the facts it was given (SPEC 6.18).
 *
 * The spec says: "validate each sentence only references provided facts (reject and regenerate
 * otherwise)" and "never generate claims that aren't in the facts JSON". A prompt cannot promise
 * that. This does, as far as a mechanical check can, and where it cannot be sure it rejects.
 *
 * Every rule errs toward rejection. The cost is asymmetric: a rejected storyline is retried, and
 * failing that simply is not shown; an accepted wrong one tells a fan the Phillies have won seven
 * straight when they have won five.
 *
 * What it checks, in the order a wrong sentence usually fails:
 *
 * 1. Shape: one sentence, short, no newline, and no em dash (Dean's standing rule for UI copy).
 * 2. Claims the facts cannot support at all: clinching, elimination, standings, injuries,
 *    history, "first time". None of those is computed, so none may be asserted.
 * 3. Numbers: every number in the sentence, digits or words, must be a number in the facts. This
 *    is where invented claims almost always show up.
 * 4. Teams: it names the team it is about, and no other team in the league.
 * 5. Proper nouns: any capitalised word that is not one of the two teams, a month, a weekday or
 *    a generic event term is treated as an invented name, most often a player's.
 */

export interface TeamName {
  /** "Philadelphia Phillies" */
  name: string;
  /** "Philadelphia". May be null for teams whose name does not start with a city. */
  city: string | null;
  /**
   * "Mets". Pass it whenever it is known, which is always, from `teams.nickname`.
   *
   * Deriving it by stripping the city off the name is only a fallback, and it fails for nine MLB
   * teams whose `city` is not the start of their name: the Mets are in Flushing, the Yankees in
   * the Bronx, the Rays in St. Petersburg. Without this the validator rejected "Mets look to snap a
   * 4-game losing streak", a correct sentence, for not naming the Mets.
   */
  nickname?: string | null;
}

export interface ValidationContext {
  /** The two teams in the game. Their names are the only team names allowed. */
  teams: readonly [TeamName, TeamName];
  /** Every team in the sport, so a mention of a third one can be caught. */
  league: readonly TeamName[];
  /**
   * The team the storyline is about, which it must name. Null for a significance storyline,
   * which must name at least one of the two.
   */
  subject: TeamName | null;
}

export type Verdict = { ok: true } | { ok: false; reason: string };

const MAX_LENGTH = 160;
// From its code point, so this file does not itself contain the character it rejects.
const EM_DASH = String.fromCharCode(0x2014);

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  // "first" is deliberately absent. In a storyline it is almost always idiomatic ("first pitch",
  // "their first home game of 2026") rather than a count, and treating it as the number 1
  // rejected correct opener storylines. The standings sense ("in first place") is caught by
  // UNSUPPORTED instead, where it belongs.
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
};

/**
 * Capitalised words that name nothing specific. A sentence may start with any word, and may use
 * these anywhere; every other capitalised word has to be one of the two teams.
 */
const GENERIC = new Set([
  'Opening',
  'Day',
  'Home',
  'Opener',
  'World',
  'Series',
  'Wild',
  'Card',
  'Division',
  'League',
  'Championship',
  'Game',
  'Postseason',
  'Playoffs',
  'Playoff',
  'Super',
  'Bowl',
  'Round',
  'Week',
  'American',
  'National',
  'AFC',
  'NFC',
  'ALCS',
  'NLCS',
  'ALDS',
  'NLDS',
  'MLB',
  'NFL',
  'NBA',
  'Finals',
  'Conference',
  'Eastern',
  'Western',
  'Cup',
  'Play',
  'In',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

/**
 * Claims no fact in this pipeline can back. Each is a thing fans care about and a model reaches
 * for, and each needs data (standings, injuries, franchise history) that is not computed.
 */
const UNSUPPORTED = [
  /\bclinch/i,
  /\beliminat/i,
  /\bmagic number\b/i,
  /\bplayoff (spot|berth|race|picture)\b/i,
  /\bmust[- ]win\b/i,
  /\binjur/i,
  /\bfirst time\b/i,
  /\bhistory\b/i,
  /\bhistoric/i,
  /\ball[- ]time\b/i,
  /\bfranchise record\b/i,
  /\brecord[- ]breaking\b/i,
  /\brival/i,
  /\brumou?r/i,
  // Standings: nothing here computes a position in a division.
  /\b(first|second|third|last) place\b/i,
  /\bstandings\b/i,
];

/**
 * Numbers a fact states by its name rather than its value. `lastTen` holds a record, but the
 * record is OF the last ten games, so "8-2 in their last 10" states nothing that is not there.
 * The first World Series run rejected exactly that correct sentence.
 */
const IMPLIED_BY_KEY: Record<string, number> = { lastTen: 10 };

/** Numeric leaves anywhere in the facts, as absolute values: a streak of -3 allows "3". */
export function allowedNumbers(facts: unknown): Set<number> {
  const out = new Set<number>();
  const walk = (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) out.add(Math.abs(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const [key, child] of Object.entries(v)) {
        const implied = IMPLIED_BY_KEY[key];
        if (implied !== undefined && child != null) out.add(implied);
        walk(child);
      }
    }
  };
  walk(facts);
  return out;
}

/** Every number a sentence states, whether written as digits or as a word. */
export function numbersIn(text: string): number[] {
  const found: number[] = [];
  for (const m of text.matchAll(/\d+/g)) found.push(Number(m[0]));
  for (const m of text.toLowerCase().matchAll(/[a-z]+/g)) {
    const n = NUMBER_WORDS[m[0]];
    if (n !== undefined) found.push(n);
  }
  return found;
}

function nickname(t: TeamName): string {
  if (t.nickname) return t.nickname;
  return t.city && t.name.startsWith(t.city) ? t.name.slice(t.city.length).trim() : t.name;
}

function mentions(text: string, phrase: string): boolean {
  if (!phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

function names(t: TeamName): string[] {
  return [t.name, nickname(t), ...(t.city ? [t.city] : [])];
}

export function validateStoryline(text: string, facts: unknown, ctx: ValidationContext): Verdict {
  const s = text.trim();

  // 1. Shape.
  if (!s) return { ok: false, reason: 'The storyline is empty.' };
  if (s.length > MAX_LENGTH) {
    return { ok: false, reason: `It is ${s.length} characters; keep it under ${MAX_LENGTH}.` };
  }
  if (/[\r\n]/.test(s)) return { ok: false, reason: 'It spans more than one line.' };
  if (s.includes(EM_DASH)) {
    return { ok: false, reason: 'It uses an em dash. Use a comma or a full stop instead.' };
  }
  if (!/[.!?]$/.test(s)) return { ok: false, reason: 'It does not end as a sentence.' };
  // Abbreviations with a full stop would otherwise read as a second sentence.
  const unabbreviated = s.replace(/\b(St|Jr|Sr|vs|Dr|Mt)\./g, '$1');
  if ((unabbreviated.slice(0, -1).match(/[.!?](\s|$)/g) ?? []).length > 0) {
    return { ok: false, reason: 'It is more than one sentence.' };
  }

  // 2. Claims the facts cannot support. Checked before the numbers on purpose: the reason goes
  //    back to the model on a retry, and "It states 1" is no help when the problem is "first time".
  for (const pattern of UNSUPPORTED) {
    const m = s.match(pattern);
    if (m) {
      return { ok: false, reason: `"${m[0]}" is a claim the facts cannot support.` };
    }
  }

  // 3. Numbers. A team whose name carries digits (the 76ers) is not stating one.
  const allowed = allowedNumbers(facts);
  let numeric = s;
  for (const t of [...ctx.teams, ...ctx.league]) {
    for (const n of names(t)) if (/\d/.test(n)) numeric = numeric.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ');
  }
  for (const n of numbersIn(numeric)) {
    if (!allowed.has(n)) {
      return { ok: false, reason: `It states ${n}, which is not in the facts.` };
    }
  }

  // 4. Teams.
  const inGame = ctx.teams.flatMap(names);
  if (ctx.subject) {
    if (!names(ctx.subject).some((n) => mentions(s, n))) {
      return { ok: false, reason: `It does not name the ${nickname(ctx.subject)}.` };
    }
  } else if (!inGame.some((n) => mentions(s, n))) {
    return { ok: false, reason: 'It names neither team in the game.' };
  }
  for (const other of ctx.league) {
    if (ctx.teams.some((t) => t.name === other.name)) continue;
    // A nickname shared with a team in the game ("Giants", "Cardinals" across sports) is only a
    // problem when it is not one of the two; the league passed in is a single sport.
    const nick = nickname(other);
    if (inGame.some((n) => n.toLowerCase() === nick.toLowerCase())) continue;
    if (mentions(s, nick) || mentions(s, other.name)) {
      return { ok: false, reason: `It mentions the ${nick}, who are not in this game.` };
    }
  }

  // 5. Proper nouns.
  // Both sides are trimmed of punctuation the same way. Without that, "St. Louis" in a team's
  // name never matched "St" in the sentence, and the Cardinals could not be named at all.
  const bare = (w: string) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9']+$/g, '');
  const allowedWords = new Set<string>(GENERIC);
  for (const n of inGame) for (const w of n.split(/\s+/)) allowedWords.add(bare(w));
  const words = s.split(/\s+/).map(bare);
  for (let i = 1; i < words.length; i++) {
    // Possessives: "Phillies'" and "Harper's" are the word they are attached to.
    const w = (words[i] ?? '').replace(/'s?$/, '');
    if (!w || !/^[A-Z]/.test(w)) continue;
    if (!allowedWords.has(w)) {
      return { ok: false, reason: `It names "${w}", which is not in the facts.` };
    }
  }

  return { ok: true };
}
